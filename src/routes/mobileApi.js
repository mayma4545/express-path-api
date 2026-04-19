/**
 * Mobile API Routes
 * Mirrors Django api_views.py for React Native mobile app
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const {
    Nodes,
    Edges,
    Annotation,
    CampusMap,
    User,
    UserProfile,
    UserStatus,
    UserActivity,
    NodeVisitAnalytics,
    Event,
    Guest,
    AppUser,
    EventAttendee,
    EventAnalytics,
    sequelize
} = require('../models');
const { getPathfinder, resetPathfinder } = require('../services/pathfinding');
const { generateQRCode, deleteQRCode } = require('../services/qrcode.cloudinary');
const { saveBase64Hybrid, deleteFileHybrid } = require('../services/upload.hybrid');

// Import services, validation and utilities
const NodeService = require('../services/NodeService');
const EdgeService = require('../services/EdgeService');
const AnnotationService = require('../services/AnnotationService');
const EventService = require('../services/EventService');
const { nodeValidation, edgeValidation, annotationValidation, pathfindingValidation, loginValidation } = require('../middleware/validate');
const { authLimiter, adminLimiter } = require('../middleware/rateLimiter');
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
    // Check for Bearer token (JWT) — primary path for mobile app
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const secret = process.env.JWT_SECRET || 'dev-jwt-secret';
            const decoded = jwt.verify(token, secret);
            req.user = decoded; // Attach decoded payload for downstream use
            upsertUserStatus(decoded.id, {
                is_online: true,
                last_activity_at: new Date()
            }).catch((error) => {
                logger.warn('Failed to refresh user status from JWT auth', { error: error.message });
            });
            return next();
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    error: 'Session expired' // Mobile app watches for this exact string
                });
            }
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials' // Avoid leaking internal details
            });
        }
    }

    // Fallback to session-based auth (legacy web dashboard / webview)
    if (req.session.user && req.session.user.is_staff) {
        // Set req.user for consistency so downstream handlers always have it
        req.user = req.session.user;
        upsertUserStatus(req.session.user.id, {
            is_online: true,
            last_activity_at: new Date()
        }).catch((error) => {
            logger.warn('Failed to refresh user status from session auth', { error: error.message });
        });
        return next();
    }

    return res.status(401).json({
        success: false,
        error: 'Authentication required'
    });
};

const requireSuperuser = (req, res, next) => {
    if (req.user && req.user.is_superuser) {
        return next();
    }

    return res.status(403).json({
        success: false,
        error: 'Super admin privileges required'
    });
};

const getRequestMeta = (req) => ({
    ip: req.headers['x-forwarded-for'] || req.ip,
    user_agent: req.get('user-agent') || null,
    method: req.method,
    path: req.originalUrl
});

const logUserActivity = async ({ userId, activityType, moduleName, targetType, targetId, metadata, isOnline }) => {
    if (!UserActivity) {
        return;
    }

    try {
        await UserActivity.create({
            user_id: userId || null,
            activity_type: activityType,
            module: moduleName,
            target_type: targetType || null,
            target_id: targetId !== undefined && targetId !== null ? String(targetId) : null,
            metadata: metadata || null,
            is_online: isOnline !== undefined ? !!isOnline : null,
            occurred_at: new Date()
        });
    } catch (error) {
        logger.warn('Failed to log user activity', { error: error.message });
    }
};

const upsertUserStatus = async (userId, payload = {}) => {
    if (!userId || !UserStatus) {
        return;
    }

    const statusPayload = {
        ...payload,
        last_activity_at: payload.last_activity_at || new Date()
    };

    const existingStatus = await UserStatus.findOne({ where: { user_id: userId } });
    if (existingStatus) {
        await existingStatus.update(statusPayload);
        return;
    }

    await UserStatus.create({
        user_id: userId,
        ...statusPayload
    });
};

// ============= Public API Endpoints =============

// Health / connectivity ping — lightweight endpoint for the mobile app's
// welcome screen to confirm the server is reachable without fetching any data.
router.get('/ping', (req, res) => {
    res.json({ isOnline: true });
});

router.post('/guests', async (req, res) => {
    try {
        const { display_type, guest_type } = req.body;

        if (!display_type || !guest_type) {
            return res.status(400).json({
                success: false,
                error: 'display_type and guest_type are required'
            });
        }

        const newGuest = await Guest.create({
            display_type: String(display_type).trim(),
            guest_type: String(guest_type).trim()
        });

        return res.status(201).json({
            success: true,
            data: newGuest
        });
    } catch (error) {
        logger.error('Guest record creation failed', { error: error.message });
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

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
            description: n.description,
            annotation: n.annotation !== null ? parseFloat(n.annotation) : null,
            created_at: n.created_at ? n.created_at.toISOString() : null
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
                annotation: node.annotation !== null ? parseFloat(node.annotation) : null,
                annotations: annotationsData
            }
        });
    } catch (error) {
        console.error('Node detail error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Track node visit for analytics (public endpoint)
router.post('/node-visit', async (req, res) => {
    try {
        const { node_id, source } = req.body;

        if (!node_id) {
            return res.status(400).json({
                success: false,
                error: 'node_id is required'
            });
        }

        const node = await Nodes.findByPk(node_id);
        if (!node) {
            return res.status(404).json({
                success: false,
                error: 'Node not found'
            });
        }

        await NodeVisitAnalytics.create({
            node_id: parseInt(node_id, 10),
            user_id: req.user?.id || null,
            source: source || 'mobile',
            visited_at: new Date()
        });

        // Add Notification for an ongoing event at this node
        try {
            const { Event, OrganizerNotification } = require('../models');
            const ongoingEvent = await Event.findOne({
                where: { venue: node.name, is_ongoing: true }
            });
            if (ongoingEvent && ongoingEvent.organizer_id) {
                await OrganizerNotification.create({
                    organizer_id: ongoingEvent.organizer_id,
                    event_id: ongoingEvent.id,
                    type: 'visit',
                    message: `A visitor just checked the map for your event venue "${ongoingEvent.venue}".`
                });
            }
        } catch (notifError) {
            console.error('Failed to create visit notification:', notifError);
        }

        res.json({
            success: true,
            message: 'Node visit recorded'
        });
    } catch (error) {
        console.error('Node visit tracking error:', error);
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

        try {
            const visitCodes = [...new Set([start_code, goal_code])];
            const visitedNodes = await Nodes.findAll({
                where: { node_code: { [Op.in]: visitCodes } },
                attributes: ['node_id']
            });

            if (visitedNodes.length > 0) {
                await NodeVisitAnalytics.bulkCreate(
                    visitedNodes.map((node) => ({
                        node_id: node.node_id,
                        user_id: null,
                        source: 'path_request',
                        visited_at: new Date()
                    }))
                );
            }
        } catch (analyticsError) {
            logger.warn('Failed to store path analytics', { error: analyticsError.message });
        }

        // Add absolute URLs for images and has_360_image flag
        for (const node of result.path) {
            node.has_360_image = !!(node.image360 && node.image360.trim());
            node.image360 = buildUrl(req, node.image360);
            // annotation is already a plain float from the DB; ensure it's passed through
            node.annotation = node.annotation !== null && node.annotation !== undefined ? parseFloat(node.annotation) : null;
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
                name: e.from_node.name,
                building: e.from_node.building
            },
            to_node: {
                node_id: e.to_node.node_id,
                node_code: e.to_node.node_code,
                name: e.to_node.name
            },
            distance: e.distance,
            compass_angle: e.compass_angle,
            is_staircase: e.is_staircase,
            is_active: e.is_active,
            created_at: e.created_at ? e.created_at.toISOString() : null
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

// Apply higher rate limit to all admin routes (prevents lockout during concurrent node edits)
router.use('/admin', adminLimiter);

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

        // Business rule: the legacy `admin` account is staff admin only.
        if (user.username === 'admin' && user.is_superuser) {
            await user.update({ is_superuser: false });
        }

        const profile = UserProfile
            ? await UserProfile.findOne({ where: { user_id: user.id } })
            : null;
        await upsertUserStatus(user.id, {
            is_online: true,
            last_login_at: new Date(),
            last_activity_at: new Date()
        });

        await logUserActivity({
            userId: user.id,
            activityType: 'LOGIN',
            moduleName: 'auth',
            targetType: 'user',
            targetId: user.id,
            metadata: getRequestMeta(req),
            isOnline: true
        });

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
                id: user.id,
                username: user.username,
                is_staff: user.is_staff,
                is_superuser: user.is_superuser,
                role: user.is_superuser ? 'superadmin' : 'staff_admin',
                profile: profile ? {
                    full_name: profile.full_name,
                    age: profile.age,
                    department: profile.department,
                    email: profile.email,
                    phone: profile.phone,
                    position: profile.position
                } : null
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/admin/logout', requireAuth, async (req, res) => {
    try {
        await upsertUserStatus(req.user.id, {
            is_online: false,
            last_logout_at: new Date(),
            last_activity_at: new Date()
        });

        await logUserActivity({
            userId: req.user.id,
            activityType: 'LOGOUT',
            moduleName: 'auth',
            targetType: 'user',
            targetId: req.user.id,
            metadata: getRequestMeta(req),
            isOnline: false
        });

        req.session.user = null;

        return res.json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// ============= Super Admin: User Management =============

router.get('/admin/super/users', requireAuth, requireSuperuser, async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'username', 'is_staff', 'is_superuser', 'created_at', 'updated_at'],
            include: [
                {
                    model: UserProfile,
                    as: 'profile',
                    required: false,
                    attributes: ['full_name', 'age', 'department', 'email', 'phone', 'position', 'profile_image']
                },
                {
                    model: UserStatus,
                    as: 'status',
                    required: false,
                    attributes: ['is_online', 'last_login_at', 'last_logout_at', 'last_activity_at']
                }
            ],
            order: [['id', 'ASC']]
        });

        res.json({
            success: true,
            users: users.map((user) => {
                // If last activity is older than 30 mins, treat as offline
                let isActuallyOnline = user.status?.is_online || false;
                if (isActuallyOnline && user.status?.last_activity_at) {
                    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
                    if (new Date(user.status.last_activity_at) < thirtyMinsAgo) {
                        isActuallyOnline = false;
                    }
                }

                return {
                    id: user.id,
                    username: user.username,
                    role: user.is_superuser ? 'superadmin' : (user.is_staff ? 'staff_admin' : 'viewer'),
                    is_staff: user.is_staff,
                    is_superuser: user.is_superuser,
                    profile: user.profile,
                    status: {
                        ...user.status?.toJSON(),
                        is_online: isActuallyOnline
                    },
                    created_at: user.created_at,
                    updated_at: user.updated_at
                };
            }),
            count: users.length
        });
    } catch (error) {
        console.error('Super admin users list error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/admin/super/users/create', requireAuth, requireSuperuser, async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const {
            username,
            password,
            full_name,
            age,
            department,
            email,
            phone,
            position,
            is_staff,
            is_superuser,
            profile_image
        } = req.body;

        if (!username || !password || !full_name) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                error: 'username, password, and full_name are required'
            });
        }

        if (is_superuser === true) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                error: 'Only one super admin account is allowed'
            });
        }

        const existingUser = await User.findOne({ where: { username }, transaction });
        if (existingUser) {
            await transaction.rollback();
            return res.status(409).json({
                success: false,
                error: 'Username already exists'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const createdUser = await User.create({
            username,
            password: hashedPassword,
            is_staff: is_staff !== false,
            is_superuser: false
        }, { transaction });

        let profileImageUrl = null;
        if (profile_image && profile_image.startsWith('data:image')) {
            const timestamp = Date.now();
            profileImageUrl = await saveBase64Hybrid(profile_image, `user_${createdUser.id}_${timestamp}.jpg`, 'profiles');
        } else if (profile_image) {
            profileImageUrl = profile_image;
        }

        await UserProfile.create({
            user_id: createdUser.id,
            full_name,
            age: age !== undefined && age !== null && age !== '' ? parseInt(age, 10) : null,
            department: department || null,
            email: email || null,
            phone: phone || null,
            position: position || null,
            profile_image: profileImageUrl
        }, { transaction });

        await UserStatus.create({
            user_id: createdUser.id,
            is_online: false,
            last_activity_at: new Date()
        }, { transaction });

        await transaction.commit();

        await logUserActivity({
            userId: req.user.id,
            activityType: 'CREATE',
            moduleName: 'users',
            targetType: 'user',
            targetId: createdUser.id,
            metadata: {
                username: createdUser.username,
                role: createdUser.is_superuser ? 'superadmin' : 'staff_admin',
                ...getRequestMeta(req)
            },
            isOnline: true
        });

        return res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: {
                id: createdUser.id,
                username: createdUser.username,
                is_staff: createdUser.is_staff,
                is_superuser: createdUser.is_superuser,
                role: createdUser.is_superuser ? 'superadmin' : 'staff_admin'
            }
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Super admin create user error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/admin/super/users/:user_id/update', requireAuth, requireSuperuser, async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const userId = parseInt(req.params.user_id, 10);
        const {
            username,
            password,
            full_name,
            age,
            department,
            email,
            phone,
            position,
            is_staff,
            is_superuser,
            profile_image
        } = req.body;

        const targetUser = await User.findByPk(userId, { transaction });
        if (!targetUser) {
            await transaction.rollback();
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Prevent modifying the main superadmin directly to remove its access, or making another superadmin
        if (is_superuser === true && targetUser.is_superuser === false) {
            await transaction.rollback();
            return res.status(400).json({ success: false, error: 'Cannot promote a user to super admin' });
        }

        if (username && username !== targetUser.username) {
            const existingUser = await User.findOne({ where: { username }, transaction });
            if (existingUser) {
                await transaction.rollback();
                return res.status(409).json({ success: false, error: 'Username already exists' });
            }
            targetUser.username = username;
        }

        if (password) {
            targetUser.password = await bcrypt.hash(password, 10);
        }

        if (is_staff !== undefined) {
            targetUser.is_staff = is_staff;
        }

        await targetUser.save({ transaction });

        const profile = await UserProfile.findOne({ where: { user_id: userId }, transaction });
        if (profile) {
            if (full_name !== undefined) profile.full_name = full_name;
            if (age !== undefined) profile.age = age !== null && age !== '' ? parseInt(age, 10) : null;
            if (department !== undefined) profile.department = department || null;
            if (email !== undefined) profile.email = email || null;
            if (phone !== undefined) profile.phone = phone || null;
            if (position !== undefined) profile.position = position || null;
            
            if (profile_image !== undefined) {
                if (profile_image && profile_image.startsWith('data:image')) {
                    const timestamp = Date.now();
                    profile.profile_image = await saveBase64Hybrid(profile_image, `user_${userId}_${timestamp}.jpg`, 'profiles');
                } else if (profile_image === null || profile_image === '') {
                    profile.profile_image = null;
                } else {
                    profile.profile_image = profile_image;
                }
            }
            
            await profile.save({ transaction });
        } else if (full_name) {
             let profileImageUrl = null;
             if (profile_image && profile_image.startsWith('data:image')) {
                 const timestamp = Date.now();
                 profileImageUrl = await saveBase64Hybrid(profile_image, `user_${userId}_${timestamp}.jpg`, 'profiles');
             } else if (profile_image) {
                 profileImageUrl = profile_image;
             }

             await UserProfile.create({
                 user_id: userId,
                 full_name,
                 age: age !== undefined && age !== null && age !== '' ? parseInt(age, 10) : null,
                 department: department || null,
                 email: email || null,
                 phone: phone || null,
                 position: position || null,
                 profile_image: profileImageUrl
             }, { transaction });
        }

        await transaction.commit();

        await logUserActivity({
            userId: req.user.id,
            activityType: 'UPDATE',
            moduleName: 'users',
            targetType: 'user',
            targetId: targetUser.id,
            metadata: {
                username: targetUser.username,
                role: targetUser.is_superuser ? 'superadmin' : 'staff_admin',
                ...getRequestMeta(req)
            },
            isOnline: true
        });

        return res.json({
            success: true,
            message: 'User updated successfully',
            user: {
                id: targetUser.id,
                username: targetUser.username,
                is_staff: targetUser.is_staff,
                is_superuser: targetUser.is_superuser,
                role: targetUser.is_superuser ? 'superadmin' : 'staff_admin'
            }
        });

    } catch (error) {
        await transaction.rollback();
        console.error('Super admin update user error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/admin/super/users/:user_id/delete', requireAuth, requireSuperuser, async (req, res) => {
    try {
        const userId = parseInt(req.params.user_id, 10);

        if (req.user.id === userId) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete your own account while logged in'
            });
        }

        const targetUser = await User.findByPk(userId);
        if (!targetUser) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const deletedUsername = targetUser.username;
        await targetUser.destroy();

        await logUserActivity({
            userId: req.user.id,
            activityType: 'DELETE',
            moduleName: 'users',
            targetType: 'user',
            targetId: userId,
            metadata: {
                deleted_username: deletedUsername,
                ...getRequestMeta(req)
            },
            isOnline: true
        });

        return res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Super admin delete user error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/admin/super/activities', requireAuth, requireSuperuser, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || 50, 10), 200);
        const where = {};
        if (req.query.user_id) {
            where.user_id = parseInt(req.query.user_id, 10);
        }

        const activities = await UserActivity.findAll({
            where,
            include: [
                {
                    model: User,
                    as: 'actor',
                    required: false,
                    attributes: ['id', 'username', 'is_staff', 'is_superuser'],
                    include: [
                        {
                            model: UserProfile,
                            as: 'profile',
                            required: false,
                            attributes: ['full_name', 'department']
                        }
                    ]
                }
            ],
            order: [['occurred_at', 'DESC']],
            limit
        });

        res.json({
            success: true,
            activities: activities.map((activity) => ({
                activity_id: activity.activity_id,
                user: activity.actor ? {
                    id: activity.actor.id,
                    username: activity.actor.username,
                    is_staff: activity.actor.is_staff,
                    is_superuser: activity.actor.is_superuser,
                    full_name: activity.actor.profile?.full_name || null,
                    department: activity.actor.profile?.department || null
                } : null,
                activity_type: activity.activity_type,
                module: activity.module,
                target_type: activity.target_type,
                target_id: activity.target_id,
                metadata: activity.metadata,
                is_online: activity.is_online,
                occurred_at: activity.occurred_at
            })),
            count: activities.length
        });
    } catch (error) {
        console.error('Super admin activities list error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/admin/super/analytics/overview', requireAuth, requireSuperuser, async (req, res) => {
    try {
        const [
            totalStaffAdmins,
            totalSuperAdmins,
            onlineUsers,
            actionTypeStats,
            moduleStats,
            mostVisitedNodes,
            activityTimeline,
            guestTypeStats,
            visitsByBuilding,
            visitsBySource,
            userNavigationTimeline
        ] = await Promise.all([
            User.count({ where: { is_staff: true, is_superuser: false } }),
            User.count({ where: { is_superuser: true } }),
            UserStatus.count({ 
                where: { 
                    is_online: true,
                    // Assume user offline if no activity in last 30 minutes
                    last_activity_at: {
                        [Op.gte]: new Date(Date.now() - 30 * 60 * 1000)
                    }
                } 
            }),
            sequelize.query(
                'SELECT activity_type, COUNT(activity_id) AS total FROM user_activities GROUP BY activity_type ORDER BY total DESC',
                { type: sequelize.QueryTypes.SELECT }
            ),
            sequelize.query(
                'SELECT module, COUNT(activity_id) AS total FROM user_activities GROUP BY module ORDER BY total DESC',
                { type: sequelize.QueryTypes.SELECT }
            ),
            sequelize.query(
                `SELECT n.node_id, n.node_code, n.name, n.building, n.floor_level, COUNT(v.visit_id) AS visit_count
                 FROM node_visit_analytics v
                 INNER JOIN nodes n ON n.node_id = v.node_id
                 GROUP BY n.node_id, n.node_code, n.name, n.building, n.floor_level
                 ORDER BY visit_count DESC
                 LIMIT 10`,
                { type: sequelize.QueryTypes.SELECT }
            ),
            sequelize.query(
                `SELECT DATE(occurred_at) AS activity_date, COUNT(activity_id) AS total_activities
                 FROM user_activities
                 WHERE occurred_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
                 GROUP BY DATE(occurred_at)
                 ORDER BY activity_date ASC`,
                { type: sequelize.QueryTypes.SELECT }
            ),
            sequelize.query(
                'SELECT guest_type, COUNT(id) AS count FROM GUEST GROUP BY guest_type ORDER BY count DESC',
                { type: sequelize.QueryTypes.SELECT }
            ),
            sequelize.query(
                `SELECT n.building, COUNT(v.visit_id) AS total_visits
                 FROM node_visit_analytics v
                 INNER JOIN nodes n ON n.node_id = v.node_id
                 WHERE n.building IS NOT NULL AND n.building != ''
                 GROUP BY n.building
                 ORDER BY total_visits DESC`,
                { type: sequelize.QueryTypes.SELECT }
            ),
            sequelize.query(
                `SELECT source, COUNT(visit_id) AS total_visits
                 FROM node_visit_analytics
                 GROUP BY source
                 ORDER BY total_visits DESC`,
                { type: sequelize.QueryTypes.SELECT }
            ),
            sequelize.query(
                `SELECT DATE(visited_at) AS visit_date, COUNT(visit_id) AS total_visits
                 FROM node_visit_analytics
                 WHERE visited_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
                 GROUP BY DATE(visited_at)
                 ORDER BY visit_date ASC`,
                { type: sequelize.QueryTypes.SELECT }
            )
        ]);

        res.json({
            success: true,
            analytics: {
                users: {
                    total_staff_admins: totalStaffAdmins,
                    total_super_admins: totalSuperAdmins,
                    total_admin_accounts: totalStaffAdmins + totalSuperAdmins,
                    online_users: onlineUsers
                },
                guest_demographics: guestTypeStats,
                actions_by_type: actionTypeStats,
                actions_by_module: moduleStats,
                most_frequent_visited_nodes: mostVisitedNodes,
                activity_timeline_last_14_days: activityTimeline,
                visits_by_building: visitsByBuilding,
                visits_by_source: visitsBySource,
                navigation_timeline_last_14_days: userNavigationTimeline
            }
        });
    } catch (error) {
        console.error('Super admin analytics error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============= Admin Dashboard Stats =============
router.get('/admin/dashboard/stats', requireAuth, async (req, res) => {
    try {
        const [
            nodesCount,
            edgesCount,
            guestsCount,
            mostVisitedNodes,
            recentActivities
        ] = await Promise.all([
            Nodes.count(),
            Edges.count({ where: { is_active: true } }),
            Guest.count(),
            sequelize.query(
                `SELECT n.node_id, n.node_code, n.name, n.building, n.floor_level, COUNT(v.visit_id) AS visit_count
                 FROM node_visit_analytics v
                 INNER JOIN nodes n ON n.node_id = v.node_id
                 GROUP BY n.node_id, n.node_code, n.name, n.building, n.floor_level
                 ORDER BY visit_count DESC
                 LIMIT 6`,
                { type: sequelize.QueryTypes.SELECT }
            ),
            UserActivity.findAll({
                include: [{ model: User, attributes: ['username'], as: 'actor' }],
                order: [['occurred_at', 'DESC']],
                limit: 10
            })
        ]);

        res.json({
            success: true,
            stats: {
                nodes: nodesCount,
                edges: edgesCount,
                users: guestsCount
            },
            frequent_paths: mostVisitedNodes,
            history: recentActivities
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============= Admin CRUD Operations =============

// Create node
router.post('/admin/nodes/create', requireAuth, async (req, res) => {
    try {
        const { node_code, name, building, floor_level, type_of_node, description, map_x, map_y, image360_base64, annotation } = req.body;

        // node_code from mobile client is accepted; NodeService auto-generates one if not supplied
        const node = await NodeService.createNode(
            { node_code, name, building, floor_level, type_of_node, description, map_x, map_y, annotation },
            image360_base64 || null
        );

        await logUserActivity({
            userId: req.user.id,
            activityType: 'CREATE',
            moduleName: 'nodes',
            targetType: 'node',
            targetId: node.node_id,
            metadata: {
                node_code: node.node_code,
                name: node.name,
                ...getRequestMeta(req)
            },
            isOnline: true
        });

        res.json({
            success: true,
            message: 'Node created successfully',
            node_id: node.node_id,
            node_code: node.node_code
        });
    } catch (error) {
        logger.error('Create node error:', error);
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

        const { node_code, name, building, floor_level, type_of_node, description, map_x, map_y, image360_base64, annotation } = req.body;

        const updateData = {
            node_code: node_code || node.node_code,
            name: name || node.name,
            building: building || node.building,
            floor_level:
                floor_level !== undefined && floor_level !== null && floor_level !== ''
                    ? parseInt(floor_level, 10)
                    : node.floor_level,
            type_of_node: type_of_node || node.type_of_node,
            description: description !== undefined ? description : node.description,
        };

        // Fix: handle annotation safely — null/undefined both mean "keep existing or clear"
        if (annotation !== undefined) {
            if (annotation === null || annotation === '') {
                updateData.annotation = null;
            } else {
                const parsed = parseFloat(annotation);
                updateData.annotation = isNaN(parsed) ? null : parsed;
            }
        } else {
            updateData.annotation = node.annotation;
        }

        if (map_x !== undefined && map_y !== undefined) {
            updateData.map_x = map_x === null || map_x === '' ? null : parseFloat(map_x);
            updateData.map_y = map_y === null || map_y === '' ? null : parseFloat(map_y);
        }

        // Handle base64 image - save to both local and Cloudinary
        // Use a timestamp-based filename so Cloudinary gets a new unique URL,
        // which allows the mobile app's offline cache to detect the change and re-download.
        if (image360_base64 && image360_base64.trim() !== '') {
            if (node.image360) await deleteFileHybrid(null, node.image360);
            const timestamp = Date.now();
            const filename = `${node_code || node.node_code}_360_${timestamp}.jpg`;
            const { cloudinaryUrl } = await saveBase64Hybrid(image360_base64, filename, '360_images');
            updateData.image360 = cloudinaryUrl;
        }

        await node.update(updateData);
        // Reload the instance so node.image360 reflects what was actually written to the DB,
        // not the potentially stale in-memory Sequelize value.
        await node.reload();
        resetPathfinder();

        await logUserActivity({
            userId: req.user.id,
            activityType: 'UPDATE',
            moduleName: 'nodes',
            targetType: 'node',
            targetId: node.node_id,
            metadata: {
                node_code: node.node_code,
                name: node.name,
                ...getRequestMeta(req)
            },
            isOnline: true
        });

        const image360Url = buildUrl(req, node.image360);

        res.json({
            success: true,
            message: 'Node updated successfully',
            image360_url: image360Url,
            node: {
                node_id: node.node_id,
                node_code: node.node_code,
                name: node.name,
                building: node.building,
                floor_level: node.floor_level,
                type_of_node: node.type_of_node,
                map_x: node.map_x !== null ? parseFloat(node.map_x) : null,
                map_y: node.map_y !== null ? parseFloat(node.map_y) : null,
                annotation: node.annotation !== null ? parseFloat(node.annotation) : null,
                description: node.description,
                has_360_image: !!(node.image360 && node.image360.trim()),
                image360: image360Url,
                image360_url: image360Url,
                created_at: node.created_at ? node.created_at.toISOString() : null
            }
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
        const deletedNodeId = node.node_id;
        const deletedNodeCode = node.node_code;
        const deletedNodeName = node.name;
        await node.destroy();
        resetPathfinder();

        console.log(`✅ Successfully deleted node ${node.node_code} and all associated data`);

        await logUserActivity({
            userId: req.user.id,
            activityType: 'DELETE',
            moduleName: 'nodes',
            targetType: 'node',
            targetId: deletedNodeId,
            metadata: {
                node_code: deletedNodeCode,
                name: deletedNodeName,
                ...getRequestMeta(req)
            },
            isOnline: true
        });

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

        await logUserActivity({
            userId: req.user.id,
            activityType: 'CREATE',
            moduleName: 'edges',
            targetType: 'edge',
            targetId: edge.edge_id,
            metadata: {
                from_node_id: edge.from_node_id,
                to_node_id: edge.to_node_id,
                ...getRequestMeta(req)
            },
            isOnline: true
        });

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

        await logUserActivity({
            userId: req.user.id,
            activityType: 'UPDATE',
            moduleName: 'edges',
            targetType: 'edge',
            targetId: edge.edge_id,
            metadata: {
                ...updateData,
                ...getRequestMeta(req)
            },
            isOnline: true
        });

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

        const deletedEdgeId = edge.edge_id;
        await edge.destroy();
        resetPathfinder();

        await logUserActivity({
            userId: req.user.id,
            activityType: 'DELETE',
            moduleName: 'edges',
            targetType: 'edge',
            targetId: deletedEdgeId,
            metadata: getRequestMeta(req),
            isOnline: true
        });

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

        await logUserActivity({
            userId: req.user.id,
            activityType: 'CREATE',
            moduleName: 'annotations',
            targetType: 'annotation',
            targetId: annotation.id,
            metadata: {
                panorama_id: annotation.panorama_id,
                target_node_id: annotation.target_node_id,
                ...getRequestMeta(req)
            },
            isOnline: true
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

        await logUserActivity({
            userId: req.user.id,
            activityType: 'UPDATE',
            moduleName: 'annotations',
            targetType: 'annotation',
            targetId: annotation.id,
            metadata: {
                ...updateData,
                ...getRequestMeta(req)
            },
            isOnline: true
        });

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

        const deletedAnnotationId = annotation.id;
        await annotation.destroy();

        await logUserActivity({
            userId: req.user.id,
            activityType: 'DELETE',
            moduleName: 'annotations',
            targetType: 'annotation',
            targetId: deletedAnnotationId,
            metadata: getRequestMeta(req),
            isOnline: true
        });

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
            nodes: results.nodes.map(n => ({
                ...n,
                image360_url: buildUrl(req, n.image360),
                has_360_image: !!(n.image360 && n.image360.trim()),
            }))
        });
    } catch (error) {
        console.error('Combined search error:', error);
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

// RSVP to an Event
router.post('/events/:event_id/rsvp', requireAuth, async (req, res) => {
    try {
        const { event_id } = req.params;
        const user_id = req.user?.id || req.session?.userAuth?.userId;

        if (!user_id) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const event = await Event.findByPk(event_id);
        if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

        if (event.status !== 'published') {
            return res.status(400).json({ success: false, error: 'Event is not open for RSVP' });
        }

        // Check Capacity
        if (event.capacity) {
            const currentRsvps = await EventAttendee.count({ where: { event_id, status: 'registered' } });
            if (currentRsvps >= event.capacity) {
                return res.status(400).json({ success: false, error: 'Event is at full capacity' });
            }
        }

        const [attendee, created] = await EventAttendee.findOrCreate({
            where: { event_id, user_id },
            defaults: { status: 'registered' }
        });

        if (!created && attendee.status === 'cancelled') {
            await attendee.update({ status: 'registered' });
        } else if (!created) {
            return res.status(400).json({ success: false, error: 'Already registered for this event' });
        }

        res.json({ success: true, message: 'RSVP successful', attendee });
    } catch (error) {
        console.error('RSVP error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Event Analytics (QR Scan or 360 View)
router.post('/events/:event_id/analytics', async (req, res) => {
    try {
        const { event_id } = req.params;
        const { type } = req.body; // 'scan' or '360_view'

        const event = await Event.findByPk(event_id);
        if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

        const [analytics] = await EventAnalytics.findOrCreate({
            where: { event_id },
            defaults: { scan_count: 0, view_count_360: 0 }
        });

        if (type === 'scan') {
            await analytics.increment('scan_count', { by: 1 });
        } else if (type === '360_view') {
            await analytics.increment('view_count_360', { by: 1 });
        } else {
            return res.status(400).json({ success: false, error: 'Invalid analytics type. Use "scan" or "360_view".' });
        }

        res.json({ success: true, message: `Analytics updated for ${type}` });
    } catch (error) {
        console.error('Event analytics error:', error);
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

        await logUserActivity({
            userId: req.user.id,
            activityType: 'CREATE',
            moduleName: 'events',
            targetType: 'event',
            targetId: event.event_id,
            metadata: {
                event_name: event.event_name,
                node_id: event.node_id,
                ...getRequestMeta(req)
            },
            isOnline: true
        });

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

        await logUserActivity({
            userId: req.user.id,
            activityType: 'UPDATE',
            moduleName: 'events',
            targetType: 'event',
            targetId: event.event_id,
            metadata: {
                ...req.body,
                ...getRequestMeta(req)
            },
            isOnline: true
        });

        res.json({
            success: true,
            message: 'Event updated successfully',
            event
        });
    } catch (error) {
        console.error('Update event error:', error);
        if (error.message === 'Node not found' || error.message === 'Event not found') {
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

        await logUserActivity({
            userId: req.user.id,
            activityType: 'DELETE',
            moduleName: 'events',
            targetType: 'event',
            targetId: req.params.event_id,
            metadata: {
                event_name: result.eventName,
                ...getRequestMeta(req)
            },
            isOnline: true
        });

        res.json({
            success: true,
            message: `Event "${result.eventName}" deleted successfully`
        });
    } catch (error) {
        console.error('Delete event error:', error);
        if (error.message === 'Event not found') {
            return res.status(404).json({ success: false, error: error.message });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;