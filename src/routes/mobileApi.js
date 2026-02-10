/**
 * Mobile API Routes
 * Mirrors Django api_views.py for React Native mobile app
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { Nodes, Edges, Annotation, CampusMap, User, Event, sequelize } = require('../models');
const { getPathfinder, resetPathfinder } = require('../services/pathfinding');
const { generateQRCode, deleteQRCode } = require('../services/qrcode.cloudinary');
const { saveBase64Hybrid, deleteFileHybrid } = require('../services/upload.hybrid');

// Import services, validation and utilities
const NodeService = require('../services/NodeService');
const EdgeService = require('../services/EdgeService');
const AnnotationService = require('../services/AnnotationService');
const EventService = require('../services/EventService');
const { nodeValidation, edgeValidation, annotationValidation, pathfindingValidation, loginValidation } = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');
const { logger } = require('../utils/logger');
const { JWT } = require('../utils/constants');

// Helper to build absolute URL
const buildUrl = (req, path) => {
    if (!path || path.trim() === '') return null;

    // If already a full URL (Cloudinary), return as-is
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }

    // Otherwise, build local media URL
    return `${req.protocol}://${req.get('host')}/media/${path}`;
};

// Auth middleware for admin routes
const requireAuth = (req, res, next) => {
    // Check for Bearer token (JWT)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const secret = process.env.JWT_SECRET || 'dev-jwt-secret';
            const decoded = jwt.verify(token, secret);
            req.user = decoded; // Attach to req.user
            return next();
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    error: 'Session expired'
                });
            }
            return res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
        }
    }

    // Fallback to session-based auth (legacy/webview)
    if (req.session.user && req.session.user.is_staff) {
        return next();
    }

    return res.status(401).json({
        success: false,
        error: 'Authentication required'
    });
};

// ============= Public API Endpoints =============

// Get list of all nodes
router.get('/nodes', async (req, res) => {
    try {
        const { search, building, floor } = req.query;

        const where = {};
        if (search) {
            where[Op.or] = [
                { node_code: { [Op.like]: `%${search}%` } },
                { name: { [Op.like]: `%${search}%` } },
                { building: { [Op.like]: `%${search}%` } }
            ];
        }
        if (building) where.building = building;
        if (floor) where.floor_level = parseInt(floor);

        const nodes = await Nodes.findAll({
            where,
            order: [['building', 'ASC'], ['floor_level', 'ASC'], ['name', 'ASC']]
        });

        const data = nodes.map(n => ({
            node_id: n.node_id,
            node_code: n.node_code,
            name: n.name,
            building: n.building,
            floor_level: n.floor_level,
            type_of_node: n.type_of_node,
            map_x: n.map_x !== null ? parseFloat(n.map_x) : null,
            map_y: n.map_y !== null ? parseFloat(n.map_y) : null,
            has_360_image: !!(n.image360 && n.image360.trim()),
            image360_url: buildUrl(req, n.image360),
            qrcode_url: buildUrl(req, n.qrcode),
            description: n.description
        }));

        res.json({
            success: true,
            nodes: data,
            count: data.length
        });
    } catch (error) {
        console.error('Nodes list error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get node details
router.get('/nodes/:node_id', async (req, res) => {
    try {
        const node = await Nodes.findByPk(req.params.node_id);

        if (!node) {
            return res.status(404).json({
                success: false,
                error: 'Node not found'
            });
        }

        // Get annotations for this node
        const annotations = await Annotation.findAll({
            where: { panorama_id: node.node_id, is_active: true },
            include: [{ model: Nodes, as: 'target_node' }]
        });

        const annotationsData = annotations.map(a => ({
            id: a.id,
            label: a.label,
            yaw: a.yaw,
            pitch: a.pitch,
            visible_radius: a.visible_radius,
            target_node: a.target_node ? {
                node_id: a.target_node.node_id,
                node_code: a.target_node.node_code,
                name: a.target_node.name
            } : null
        }));

        res.json({
            success: true,
            node: {
                node_id: node.node_id,
                node_code: node.node_code,
                name: node.name,
                building: node.building,
                floor_level: node.floor_level,
                type_of_node: node.type_of_node,
                map_x: node.map_x !== null ? parseFloat(node.map_x) : null,
                map_y: node.map_y !== null ? parseFloat(node.map_y) : null,
                image360_url: buildUrl(req, node.image360),
                qrcode_url: buildUrl(req, node.qrcode),
                description: node.description,
                annotations: annotationsData
            }
        });
    } catch (error) {
        console.error('Node detail error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get list of buildings
router.get('/buildings', async (req, res) => {
    try {
        const buildings = await Nodes.findAll({
            attributes: ['building'],
            group: ['building'],
            order: [['building', 'ASC']],
            raw: true
        });

        res.json({
            success: true,
            buildings: buildings.map(b => b.building)
        });
    } catch (error) {
        console.error('Buildings list error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get active campus map
router.get('/campus-map', async (req, res) => {
    try {
        const campusMap = await CampusMap.findOne({ where: { is_active: true } });

        if (!campusMap) {
            return res.status(404).json({
                success: false,
                error: 'No active campus map found'
            });
        }

        res.json({
            success: true,
            map: {
                map_id: campusMap.map_id,
                name: campusMap.name,
                image_url: buildUrl(req, campusMap.blueprint_image),
                scale_meters_per_pixel: campusMap.scale_meters_per_pixel
            }
        });
    } catch (error) {
        console.error('Campus map error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get data version - returns timestamps for change detection
router.get('/data-version', async (req, res) => {
    try {
        // Get counts - these always work
        const [nodesCount, edgesCount, annotationsCount] = await Promise.all([
            Nodes.count(),
            Edges.count({ where: { is_active: true } }),
            Annotation.count({ where: { is_active: true } })
        ]);

        // Try to get latest update timestamps, fallback to epoch if columns don't exist
        let nodesUpdate, edgesUpdate, annotationsUpdate;

        try {
            const result = await sequelize.query(
                'SELECT MAX(updated_at) as lastUpdate FROM nodes',
                { type: sequelize.QueryTypes.SELECT }
            );
            nodesUpdate = result[0]?.lastUpdate || new Date(0).toISOString();
        } catch (e) {
            // Column doesn't exist, use current time
            nodesUpdate = new Date().toISOString();
        }

        try {
            const result = await sequelize.query(
                'SELECT MAX(updated_at) as lastUpdate FROM edges',
                { type: sequelize.QueryTypes.SELECT }
            );
            edgesUpdate = result[0]?.lastUpdate || new Date(0).toISOString();
        } catch (e) {
            edgesUpdate = new Date().toISOString();
        }

        try {
            const result = await sequelize.query(
                'SELECT MAX(updated_at) as lastUpdate FROM annotations',
                { type: sequelize.QueryTypes.SELECT }
            );
            annotationsUpdate = result[0]?.lastUpdate || new Date(0).toISOString();
        } catch (e) {
            annotationsUpdate = new Date().toISOString();
        }

        res.json({
            success: true,
            version: {
                nodes_updated: nodesUpdate,
                edges_updated: edgesUpdate,
                annotations_updated: annotationsUpdate,
                nodes_count: nodesCount,
                edges_count: edgesCount,
                annotations_count: annotationsCount,
                server_time: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Data version error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Find path between nodes
router.post('/find-path', async (req, res) => {
    try {
        const { start_code, goal_code, avoid_stairs } = req.body;

        if (!start_code || !goal_code) {
            return res.status(400).json({
                success: false,
                error: 'start_code and goal_code are required'
            });
        }

        const pathfinder = getPathfinder();
        const result = await pathfinder.getDirections(start_code, goal_code, avoid_stairs || false);

        if (result.error) {
            return res.status(404).json({ success: false, error: result.error });
        }

        // Add absolute URLs for images and has_360_image flag
        for (const node of result.path) {
            node.has_360_image = !!(node.image360 && node.image360.trim());
            node.image360 = buildUrl(req, node.image360);
        }

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Find path error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get list of edges
router.get('/edges', async (req, res) => {
    try {
        const edges = await Edges.findAll({
            include: [
                { model: Nodes, as: 'from_node' },
                { model: Nodes, as: 'to_node' }
            ]
        });

        const data = edges.map(e => ({
            edge_id: e.edge_id,
            from_node: {
                node_id: e.from_node.node_id,
                node_code: e.from_node.node_code,
                name: e.from_node.name
            },
            to_node: {
                node_id: e.to_node.node_id,
                node_code: e.to_node.node_code,
                name: e.to_node.name
            },
            distance: e.distance,
            compass_angle: e.compass_angle,
            is_staircase: e.is_staircase,
            is_active: e.is_active
        }));

        res.json({
            success: true,
            edges: data,
            count: data.length
        });
    } catch (error) {
        console.error('Edges list error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get list of annotations
router.get('/annotations', async (req, res) => {
    try {
        const { panorama_id } = req.query;

        const where = {};
        if (panorama_id) where.panorama_id = parseInt(panorama_id);

        const annotations = await Annotation.findAll({
            where,
            include: [
                { model: Nodes, as: 'panorama' },
                { model: Nodes, as: 'target_node' }
            ]
        });

        const data = annotations.map(a => ({
            id: a.id,
            panorama: {
                node_id: a.panorama.node_id,
                node_code: a.panorama.node_code,
                name: a.panorama.name
            },
            target_node: a.target_node ? {
                node_id: a.target_node.node_id,
                node_code: a.target_node.node_code,
                name: a.target_node.name
            } : null,
            label: a.label,
            yaw: a.yaw,
            pitch: a.pitch,
            visible_radius: a.visible_radius,
            is_active: a.is_active
        }));

        res.json({
            success: true,
            annotations: data,
            count: data.length
        });
    } catch (error) {
        console.error('Annotations list error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============= Admin Authentication =============

router.post('/admin/login', authLimiter, loginValidation, async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ where: { username } });

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials or not an admin user'
            });
        }

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid || !user.is_staff) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials or not an admin user'
            });
        }

        // Generate JWT Token
        const secret = process.env.JWT_SECRET || 'dev-jwt-secret';
        const token = jwt.sign(
            { id: user.id, username: user.username, is_staff: user.is_staff, is_superuser: user.is_superuser },
            secret,
            { expiresIn: JWT.EXPIRES_IN }
        );

        // Store user in session (legacy support)
        req.session.user = {
            id: user.id,
            username: user.username,
            is_staff: user.is_staff,
            is_superuser: user.is_superuser
        };

        res.json({
            success: true,
            message: 'Login successful',
            token: token,
            user: {
                username: user.username,
                is_staff: user.is_staff,
                is_superuser: user.is_superuser
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============= Admin CRUD Operations =============

// Create node
router.post('/admin/nodes/create', requireAuth, async (req, res) => {
    try {
        const { node_code, name, building, floor_level, type_of_node, description, map_x, map_y, image360_base64 } = req.body;

        const node = await Nodes.create({
            node_code,
            name,
            building,
            floor_level: parseInt(floor_level),
            type_of_node: type_of_node || 'room',
            description: description || '',
            map_x: map_x ? parseFloat(map_x) : null,
            map_y: map_y ? parseFloat(map_y) : null
        });

        // Handle base64 image - save to both local and Cloudinary
        if (image360_base64) {
            const { cloudinaryUrl } = await saveBase64Hybrid(image360_base64, `${node.node_code}_360.jpg`, '360_images');
            await node.update({ image360: cloudinaryUrl });
        }

        // Generate QR code
        const qrcodeUrl = await generateQRCode(node);
        await node.update({ qrcode: qrcodeUrl });

        resetPathfinder();

        res.json({
            success: true,
            message: 'Node created successfully',
            node_id: node.node_id
        });
    } catch (error) {
        console.error('Create node error:', error);
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({ success: false, error: `Missing field: ${error.errors[0].path}` });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update node
router.put('/admin/nodes/:node_id/update', requireAuth, async (req, res) => {
    try {
        const node = await Nodes.findByPk(req.params.node_id);

        if (!node) {
            return res.status(404).json({ success: false, error: 'Node not found' });
        }

        const { node_code, name, building, floor_level, type_of_node, description, map_x, map_y, image360_base64 } = req.body;

        const updateData = {
            node_code: node_code || node.node_code,
            name: name || node.name,
            building: building || node.building,
            floor_level: floor_level ? parseInt(floor_level) : node.floor_level,
            type_of_node: type_of_node || node.type_of_node,
            description: description !== undefined ? description : node.description
        };

        if (map_x !== undefined && map_y !== undefined) {
            updateData.map_x = parseFloat(map_x);
            updateData.map_y = parseFloat(map_y);
        }

        // Handle base64 image - save to both local and Cloudinary
        if (image360_base64) {
            if (node.image360) await deleteFileHybrid(null, node.image360);
            const { cloudinaryUrl } = await saveBase64Hybrid(image360_base64, `${node_code || node.node_code}_360.jpg`, '360_images');
            updateData.image360 = cloudinaryUrl;
        }

        await node.update(updateData);
        resetPathfinder();

        res.json({
            success: true,
            message: 'Node updated successfully'
        });
    } catch (error) {
        console.error('Update node error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete node
router.delete('/admin/nodes/:node_id/delete', requireAuth, async (req, res) => {
    try {
        const node = await Nodes.findByPk(req.params.node_id);

        if (!node) {
            return res.status(404).json({ success: false, error: 'Node not found' });
        }

        // Delete all related edges first (both from and to this node)
        await Edges.destroy({
            where: {
                [Op.or]: [
                    { from_node_id: node.node_id },
                    { to_node_id: node.node_id }
                ]
            }
        });

        // Delete all related annotations
        await Annotation.destroy({
            where: {
                [Op.or]: [
                    { panorama_id: node.node_id },
                    { target_node_id: node.node_id }
                ]
            }
        });

        // Delete associated files from both Cloudinary and local storage
        if (node.image360) {
            console.log(`🗑️  Deleting 360° image: ${node.image360}`);
            await deleteFileHybrid(null, node.image360);
        }
        if (node.qrcode) {
            console.log(`🗑️  Deleting QR code: ${node.qrcode}`);
            await deleteQRCode(node.qrcode);
        }

        // Now safe to delete the node
        await node.destroy();
        resetPathfinder();

        console.log(`✅ Successfully deleted node ${node.node_code} and all associated data`);

        res.json({
            success: true,
            message: 'Node and all related data deleted successfully'
        });
    } catch (error) {
        console.error('Delete node error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create edge
router.post('/admin/edges/create', requireAuth, async (req, res) => {
    try {
        const { from_node_id, to_node_id, distance, compass_angle, is_staircase, is_active } = req.body;

        const [fromNode, toNode] = await Promise.all([
            Nodes.findByPk(from_node_id),
            Nodes.findByPk(to_node_id)
        ]);

        if (!fromNode || !toNode) {
            return res.status(404).json({ success: false, error: 'Node not found' });
        }

        const edge = await Edges.create({
            from_node_id: parseInt(from_node_id),
            to_node_id: parseInt(to_node_id),
            distance: parseFloat(distance),
            compass_angle: parseFloat(compass_angle),
            is_staircase: is_staircase || false,
            is_active: is_active !== false
        });

        resetPathfinder();

        res.json({
            success: true,
            message: 'Edge created successfully',
            edge_id: edge.edge_id
        });
    } catch (error) {
        console.error('Create edge error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update edge
router.put('/admin/edges/:edge_id/update', requireAuth, async (req, res) => {
    try {
        const edge = await Edges.findByPk(req.params.edge_id);

        if (!edge) {
            return res.status(404).json({ success: false, error: 'Edge not found' });
        }

        const { from_node_id, to_node_id, distance, compass_angle, is_staircase, is_active } = req.body;

        const updateData = {};

        if (from_node_id !== undefined) {
            const fromNode = await Nodes.findByPk(from_node_id);
            if (!fromNode) return res.status(404).json({ success: false, error: 'From node not found' });
            updateData.from_node_id = parseInt(from_node_id);
        }

        if (to_node_id !== undefined) {
            const toNode = await Nodes.findByPk(to_node_id);
            if (!toNode) return res.status(404).json({ success: false, error: 'To node not found' });
            updateData.to_node_id = parseInt(to_node_id);
        }

        if (distance !== undefined) updateData.distance = parseFloat(distance);
        if (compass_angle !== undefined) updateData.compass_angle = parseFloat(compass_angle);
        if (is_staircase !== undefined) updateData.is_staircase = is_staircase;
        if (is_active !== undefined) updateData.is_active = is_active;

        await edge.update(updateData);
        resetPathfinder();

        res.json({
            success: true,
            message: 'Edge updated successfully'
        });
    } catch (error) {
        console.error('Update edge error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete edge
router.delete('/admin/edges/:edge_id/delete', requireAuth, async (req, res) => {
    try {
        const edge = await Edges.findByPk(req.params.edge_id);

        if (!edge) {
            return res.status(404).json({ success: false, error: 'Edge not found' });
        }

        await edge.destroy();
        resetPathfinder();

        res.json({
            success: true,
            message: 'Edge deleted successfully'
        });
    } catch (error) {
        console.error('Delete edge error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create annotation
router.post('/admin/annotations/create', requireAuth, async (req, res) => {
    try {
        const { panorama_id, target_node_id, label, yaw, pitch, visible_radius, is_active } = req.body;

        const panorama = await Nodes.findByPk(panorama_id);
        if (!panorama) {
            return res.status(404).json({ success: false, error: 'Panorama node not found' });
        }

        if (target_node_id) {
            const targetNode = await Nodes.findByPk(target_node_id);
            if (!targetNode) {
                return res.status(404).json({ success: false, error: 'Target node not found' });
            }
        }

        const annotation = await Annotation.create({
            panorama_id: parseInt(panorama_id),
            target_node_id: target_node_id ? parseInt(target_node_id) : null,
            label,
            yaw: parseFloat(yaw),
            pitch: parseFloat(pitch),
            visible_radius: parseFloat(visible_radius || 10),
            is_active: is_active !== false
        });

        res.json({
            success: true,
            message: 'Annotation created successfully',
            annotation_id: annotation.id
        });
    } catch (error) {
        console.error('Create annotation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update annotation
router.put('/admin/annotations/:annotation_id/update', requireAuth, async (req, res) => {
    try {
        const annotation = await Annotation.findByPk(req.params.annotation_id);

        if (!annotation) {
            return res.status(404).json({ success: false, error: 'Annotation not found' });
        }

        const { panorama_id, target_node_id, label, yaw, pitch, visible_radius, is_active } = req.body;

        const updateData = {};

        if (panorama_id !== undefined) {
            const panorama = await Nodes.findByPk(panorama_id);
            if (!panorama) return res.status(404).json({ success: false, error: 'Panorama node not found' });
            updateData.panorama_id = parseInt(panorama_id);
        }

        if (target_node_id !== undefined) {
            if (target_node_id) {
                const targetNode = await Nodes.findByPk(target_node_id);
                if (!targetNode) return res.status(404).json({ success: false, error: 'Target node not found' });
                updateData.target_node_id = parseInt(target_node_id);
            } else {
                updateData.target_node_id = null;
            }
        }

        if (label !== undefined) updateData.label = label;
        if (yaw !== undefined) updateData.yaw = parseFloat(yaw);
        if (pitch !== undefined) updateData.pitch = parseFloat(pitch);
        if (visible_radius !== undefined) updateData.visible_radius = parseFloat(visible_radius);
        if (is_active !== undefined) updateData.is_active = is_active;

        await annotation.update(updateData);

        res.json({
            success: true,
            message: 'Annotation updated successfully'
        });
    } catch (error) {
        console.error('Update annotation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete annotation
router.delete('/admin/annotations/:annotation_id/delete', requireAuth, async (req, res) => {
    try {
        const annotation = await Annotation.findByPk(req.params.annotation_id);

        if (!annotation) {
            return res.status(404).json({ success: false, error: 'Annotation not found' });
        }

        await annotation.destroy();

        res.json({
            success: true,
            message: 'Annotation deleted successfully'
        });
    } catch (error) {
        console.error('Delete annotation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============= Event Endpoints =============

// Get active/upcoming events (public)
router.get('/events', async (req, res) => {
    try {
        const { search, category, from_date, to_date } = req.query;
        const events = await EventService.getActiveEvents({ search, category, from_date, to_date });

        const data = events.map(e => ({
            event_id: e.event_id,
            event_name: e.event_name,
            description: e.description,
            category: e.category,
            start_datetime: e.start_datetime,
            end_datetime: e.end_datetime,
            is_featured: e.is_featured,
            location: e.location ? {
                node_id: e.location.node_id,
                node_code: e.location.node_code,
                name: e.location.name,
                building: e.location.building,
                floor_level: e.location.floor_level,
                map_x: e.location.map_x,
                map_y: e.location.map_y
            } : null
        }));

        res.json({
            success: true,
            events: data,
            count: data.length
        });
    } catch (error) {
        console.error('Events list error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get event details by ID (public)
router.get('/events/:event_id', async (req, res) => {
    try {
        const event = await EventService.getEventById(req.params.event_id);

        if (!event) {
            return res.status(404).json({
                success: false,
                error: 'Event not found'
            });
        }

        res.json({
            success: true,
            event: {
                event_id: event.event_id,
                event_name: event.event_name,
                description: event.description,
                category: event.category,
                start_datetime: event.start_datetime,
                end_datetime: event.end_datetime,
                is_active: event.is_active,
                is_featured: event.is_featured,
                location: event.location ? {
                    node_id: event.location.node_id,
                    node_code: event.location.node_code,
                    name: event.location.name,
                    building: event.location.building,
                    floor_level: event.location.floor_level,
                    map_x: event.location.map_x,
                    map_y: event.location.map_y,
                    description: event.location.description
                } : null
            }
        });
    } catch (error) {
        console.error('Event detail error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Combined search for events and nodes (public)
router.get('/events/search', async (req, res) => {
    try {
        const { query } = req.query;

        if (!query || query.trim() === '') {
            return res.json({
                success: true,
                events: [],
                nodes: []
            });
        }

        const results = await EventService.combinedSearch(query);

        res.json({
            success: true,
            events: results.events,
            nodes: results.nodes
        });
    } catch (error) {
        console.error('Combined search error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all events - admin only
router.get('/admin/events/all', requireAuth, async (req, res) => {
    try {
        const events = await EventService.getAllEvents();

        const data = events.map(e => ({
            event_id: e.event_id,
            event_name: e.event_name,
            description: e.description,
            category: e.category,
            start_datetime: e.start_datetime,
            end_datetime: e.end_datetime,
            is_active: e.is_active,
            is_featured: e.is_featured,
            location: e.location ? {
                node_id: e.location.node_id,
                node_code: e.location.node_code,
                name: e.location.name,
                building: e.location.building,
                floor_level: e.location.floor_level
            } : null
        }));

        res.json({
            success: true,
            events: data,
            count: data.length
        });
    } catch (error) {
        console.error('Admin events list error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create event (admin only)
router.post('/admin/events/create', requireAuth, async (req, res) => {
    try {
        const { event_name, description, category, node_id, start_datetime, end_datetime, is_active, is_featured } = req.body;

        if (!event_name || !node_id) {
            return res.status(400).json({
                success: false,
                error: 'event_name and node_id are required'
            });
        }

        const event = await EventService.createEvent(req.body);

        res.json({
            success: true,
            message: 'Event created successfully',
            event_id: event.event_id,
            event
        });
    } catch (error) {
        console.error('Create event error:', error);
        if (error.message === 'Node not found') {
            return res.status(404).json({ success: false, error: error.message });
        }
        if (error.message.includes('datetime')) {
            return res.status(400).json({ success: false, error: error.message });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update event (admin only)
router.put('/admin/events/:event_id/update', requireAuth, async (req, res) => {
    try {
        const event = await EventService.updateEvent(req.params.event_id, req.body);

        if (!event) {
            return res.status(404).json({
                success: false,
                error: 'Event not found'
            });
        }

        res.json({
            success: true,
            message: 'Event updated successfully',
            event
        });
    } catch (error) {
        console.error('Update event error:', error);
        if (error.message === 'Node not found') {
            return res.status(404).json({ success: false, error: error.message });
        }
        if (error.message.includes('datetime')) {
            return res.status(400).json({ success: false, error: error.message });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete event (admin only)
router.delete('/admin/events/:event_id/delete', requireAuth, async (req, res) => {
    try {
        const result = await EventService.deleteEvent(req.params.event_id);

        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'Event not found'
            });
        }

        res.json({
            success: true,
            message: `Event "${result.eventName}" deleted successfully`
        });
    } catch (error) {
        console.error('Delete event error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;