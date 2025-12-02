/**
 * Web Routes - Main Dashboard & CRUD Views
 * Mirrors Django views.py for web interface
 */

const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Nodes, Edges, Annotation, CampusMap } = require('../models');
const { getPathfinder, resetPathfinder } = require('../services/pathfinding');
const { generateQRCode, deleteQRCode } = require('../services/qrcode.cloudinary');
const { upload360Hybrid, saveFileHybrid, deleteFileHybrid } = require('../services/upload.hybrid');

// ============= Main Dashboard =============
router.get('/', async (req, res) => {
    try {
        const [totalNodes, totalEdges, totalAnnotations, buildings] = await Promise.all([
            Nodes.count(),
            Edges.count(),
            Annotation.count(),
            Nodes.findAll({
                attributes: ['building'],
                group: ['building'],
                raw: true
            })
        ]);

        res.render('index', {
            title: 'Dashboard - Campus Navigator',
            total_nodes: totalNodes,
            total_edges: totalEdges,
            total_annotations: totalAnnotations,
            buildings: buildings.map(b => b.building)
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

// ============= Nodes CRUD =============
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

        const [nodes, buildings, floors] = await Promise.all([
            Nodes.findAll({ where, order: [['building', 'ASC'], ['floor_level', 'ASC'], ['node_code', 'ASC']] }),
            Nodes.findAll({ attributes: ['building'], group: ['building'], raw: true }),
            Nodes.findAll({ attributes: ['floor_level'], group: ['floor_level'], order: [['floor_level', 'ASC']], raw: true })
        ]);

        res.render('nodes_list', {
            title: 'Nodes - Campus Navigator',
            nodes,
            search: search || '',
            building_filter: building || '',
            floor_filter: floor || '',
            buildings: buildings.map(b => b.building),
            floors: floors.map(f => f.floor_level)
        });
    } catch (error) {
        console.error('Nodes list error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

router.get('/nodes/create', async (req, res) => {
    try {
        const campusMap = await CampusMap.findOne({ where: { is_active: true } });
        res.render('node_form', {
            title: 'Create Node - Campus Navigator',
            mode: 'create',
            node: null,
            campus_map: campusMap
        });
    } catch (error) {
        console.error('Node create page error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

router.post('/nodes/create', upload360Hybrid.single('image_360'), async (req, res) => {
    try {
        const { node_code, name, building, floor_level, type_of_node, description, map_x, map_y } = req.body;

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

        // Save image to both local (backup) and Cloudinary
        if (req.file) {
            const { cloudinaryUrl } = await saveFileHybrid(req.file, '360_images');
            await node.update({ image360: cloudinaryUrl });
        }

        // Generate QR code and upload to Cloudinary
        const qrcodeUrl = await generateQRCode(node);
        await node.update({ qrcode: qrcodeUrl });

        resetPathfinder();
        req.flash('success', `Node "${name}" created successfully with QR code!`);
        res.redirect('/nodes');
    } catch (error) {
        console.error('Node create error:', error);
        req.flash('error', `Error creating node: ${error.message}`);
        res.redirect('/nodes/create');
    }
});

router.get('/nodes/:node_id/edit', async (req, res) => {
    try {
        const node = await Nodes.findByPk(req.params.node_id);
        if (!node) {
            req.flash('error', 'Node not found');
            return res.redirect('/nodes');
        }

        const campusMap = await CampusMap.findOne({ where: { is_active: true } });
        res.render('node_form', {
            title: 'Edit Node - Campus Navigator',
            mode: 'edit',
            node,
            campus_map: campusMap
        });
    } catch (error) {
        console.error('Node edit page error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

router.post('/nodes/:node_id/edit', upload360Hybrid.single('image_360'), async (req, res) => {
    try {
        const node = await Nodes.findByPk(req.params.node_id);
        if (!node) {
            req.flash('error', 'Node not found');
            return res.redirect('/nodes');
        }

        const { node_code, name, building, floor_level, type_of_node, description, map_x, map_y, regenerate_qr } = req.body;
        const oldNodeCode = node.node_code;

        const updateData = {
            node_code,
            name,
            building,
            floor_level: parseInt(floor_level),
            type_of_node: type_of_node || 'room',
            description: description || '',
            map_x: map_x ? parseFloat(map_x) : null,
            map_y: map_y ? parseFloat(map_y) : null
        };

        if (req.file) {
            // Delete old image from both local and Cloudinary
            if (node.image360) await deleteFileHybrid(null, node.image360);
            const { cloudinaryUrl } = await saveFileHybrid(req.file, '360_images');
            updateData.image360 = cloudinaryUrl;
        }

        await node.update(updateData);

        // Regenerate QR code if node_code changed
        if (regenerate_qr || node_code !== oldNodeCode) {
            if (node.qrcode) await deleteQRCode(node.qrcode);
            const qrcodeUrl = await generateQRCode(node);
            await node.update({ qrcode: qrcodeUrl });
        }

        resetPathfinder();
        req.flash('success', `Node "${name}" updated successfully!`);
        res.redirect('/nodes');
    } catch (error) {
        console.error('Node update error:', error);
        req.flash('error', `Error updating node: ${error.message}`);
        res.redirect(`/nodes/${req.params.node_id}/edit`);
    }
});

router.get('/nodes/:node_id/delete', async (req, res) => {
    try {
        const node = await Nodes.findByPk(req.params.node_id);
        if (!node) {
            req.flash('error', 'Node not found');
            return res.redirect('/nodes');
        }
        res.render('node_confirm_delete', { title: 'Delete Node', node });
    } catch (error) {
        console.error('Node delete page error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

router.post('/nodes/:node_id/delete', async (req, res) => {
    try {
        const node = await Nodes.findByPk(req.params.node_id);
        if (!node) {
            req.flash('error', 'Node not found');
            return res.redirect('/nodes');
        }

        const nodeName = node.name;
        
        // Delete associated images from both local and Cloudinary
        if (node.image360) await deleteFileHybrid(null, node.image360);
        if (node.qrcode) await deleteQRCode(node.qrcode);
        
        await node.destroy();
        resetPathfinder();
        
        req.flash('success', `Node "${nodeName}" deleted successfully!`);
        res.redirect('/nodes');
    } catch (error) {
        console.error('Node delete error:', error);
        req.flash('error', `Error deleting node: ${error.message}`);
        res.redirect('/nodes');
    }
});

// ============= Edges CRUD =============
router.get('/edges', async (req, res) => {
    try {
        const { status, staircase } = req.query;
        
        const where = {};
        if (status === 'active') where.is_active = true;
        else if (status === 'inactive') where.is_active = false;
        if (staircase === 'yes') where.is_staircase = true;
        else if (staircase === 'no') where.is_staircase = false;

        const edges = await Edges.findAll({
            where,
            include: [
                { model: Nodes, as: 'from_node' },
                { model: Nodes, as: 'to_node' }
            ],
            order: [['created_at', 'DESC']]
        });

        res.render('edges_list', {
            title: 'Edges - Campus Navigator',
            edges,
            status_filter: status || '',
            stair_filter: staircase || ''
        });
    } catch (error) {
        console.error('Edges list error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

router.get('/edges/create', async (req, res) => {
    try {
        const nodes = await Nodes.findAll({ order: [['building', 'ASC'], ['name', 'ASC']] });
        res.render('edge_form', {
            title: 'Create Edge - Campus Navigator',
            mode: 'create',
            edge: null,
            nodes
        });
    } catch (error) {
        console.error('Edge create page error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

router.post('/edges/create', async (req, res) => {
    try {
        const { from_node, to_node, distance, compass_angle, is_staircase, is_active } = req.body;

        await Edges.create({
            from_node_id: parseInt(from_node),
            to_node_id: parseInt(to_node),
            distance: parseFloat(distance),
            compass_angle: parseFloat(compass_angle),
            is_staircase: is_staircase === 'on',
            is_active: is_active !== 'off'
        });

        resetPathfinder();
        req.flash('success', 'Edge created successfully!');
        res.redirect('/edges');
    } catch (error) {
        console.error('Edge create error:', error);
        req.flash('error', `Error creating edge: ${error.message}`);
        res.redirect('/edges/create');
    }
});

router.get('/edges/:edge_id/edit', async (req, res) => {
    try {
        const edge = await Edges.findByPk(req.params.edge_id, {
            include: [
                { model: Nodes, as: 'from_node' },
                { model: Nodes, as: 'to_node' }
            ]
        });
        if (!edge) {
            req.flash('error', 'Edge not found');
            return res.redirect('/edges');
        }

        const nodes = await Nodes.findAll({ order: [['building', 'ASC'], ['name', 'ASC']] });
        res.render('edge_form', {
            title: 'Edit Edge - Campus Navigator',
            mode: 'edit',
            edge,
            nodes
        });
    } catch (error) {
        console.error('Edge edit page error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

router.post('/edges/:edge_id/edit', async (req, res) => {
    try {
        const edge = await Edges.findByPk(req.params.edge_id);
        if (!edge) {
            req.flash('error', 'Edge not found');
            return res.redirect('/edges');
        }

        const { from_node, to_node, distance, compass_angle, is_staircase, is_active } = req.body;

        await edge.update({
            from_node_id: parseInt(from_node),
            to_node_id: parseInt(to_node),
            distance: parseFloat(distance),
            compass_angle: parseFloat(compass_angle),
            is_staircase: is_staircase === 'on',
            is_active: is_active !== 'off'
        });

        resetPathfinder();
        req.flash('success', 'Edge updated successfully!');
        res.redirect('/edges');
    } catch (error) {
        console.error('Edge update error:', error);
        req.flash('error', `Error updating edge: ${error.message}`);
        res.redirect(`/edges/${req.params.edge_id}/edit`);
    }
});

router.get('/edges/:edge_id/delete', async (req, res) => {
    try {
        const edge = await Edges.findByPk(req.params.edge_id, {
            include: [
                { model: Nodes, as: 'from_node' },
                { model: Nodes, as: 'to_node' }
            ]
        });
        if (!edge) {
            req.flash('error', 'Edge not found');
            return res.redirect('/edges');
        }
        res.render('edge_confirm_delete', { title: 'Delete Edge', edge });
    } catch (error) {
        console.error('Edge delete page error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

router.post('/edges/:edge_id/delete', async (req, res) => {
    try {
        const edge = await Edges.findByPk(req.params.edge_id);
        if (!edge) {
            req.flash('error', 'Edge not found');
            return res.redirect('/edges');
        }

        await edge.destroy();
        resetPathfinder();
        
        req.flash('success', 'Edge deleted successfully!');
        res.redirect('/edges');
    } catch (error) {
        console.error('Edge delete error:', error);
        req.flash('error', `Error deleting edge: ${error.message}`);
        res.redirect('/edges');
    }
});

// ============= Annotations CRUD =============
router.get('/annotations', async (req, res) => {
    try {
        const { panorama } = req.query;
        
        const where = {};
        if (panorama) where.panorama_id = parseInt(panorama);

        const [annotations, panoramas] = await Promise.all([
            Annotation.findAll({
                where,
                include: [
                    { model: Nodes, as: 'panorama' },
                    { model: Nodes, as: 'target_node' }
                ],
                order: [['panorama_id', 'ASC'], ['yaw', 'ASC']]
            }),
            Nodes.findAll({
                where: { image360: { [Op.not]: null } },
                order: [['name', 'ASC']]
            })
        ]);

        res.render('annotations_list', {
            title: 'Annotations - Campus Navigator',
            annotations,
            panorama_filter: panorama || '',
            panoramas
        });
    } catch (error) {
        console.error('Annotations list error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

router.get('/annotations/create', async (req, res) => {
    try {
        const [nodes, panoramas] = await Promise.all([
            Nodes.findAll({ order: [['building', 'ASC'], ['name', 'ASC']] }),
            Nodes.findAll({
                where: { image360: { [Op.not]: null } },
                order: [['name', 'ASC']]
            })
        ]);

        res.render('annotation_form', {
            title: 'Create Annotation - Campus Navigator',
            mode: 'create',
            annotation: null,
            nodes,
            panoramas
        });
    } catch (error) {
        console.error('Annotation create page error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

router.post('/annotations/create', async (req, res) => {
    try {
        const { panorama, target_node, label, yaw, pitch, visible_radius, is_active } = req.body;

        await Annotation.create({
            panorama_id: parseInt(panorama),
            target_node_id: target_node ? parseInt(target_node) : null,
            label,
            yaw: parseFloat(yaw),
            pitch: parseFloat(pitch),
            visible_radius: parseFloat(visible_radius || 10),
            is_active: is_active !== 'off'
        });

        req.flash('success', `Annotation "${label}" created!`);
        res.redirect('/annotations');
    } catch (error) {
        console.error('Annotation create error:', error);
        req.flash('error', `Error creating annotation: ${error.message}`);
        res.redirect('/annotations/create');
    }
});

router.get('/annotations/:annotation_id/edit', async (req, res) => {
    try {
        const annotation = await Annotation.findByPk(req.params.annotation_id, {
            include: [
                { model: Nodes, as: 'panorama' },
                { model: Nodes, as: 'target_node' }
            ]
        });
        if (!annotation) {
            req.flash('error', 'Annotation not found');
            return res.redirect('/annotations');
        }

        const [nodes, panoramas] = await Promise.all([
            Nodes.findAll({ order: [['building', 'ASC'], ['name', 'ASC']] }),
            Nodes.findAll({
                where: { image360: { [Op.not]: null } },
                order: [['name', 'ASC']]
            })
        ]);

        res.render('annotation_form', {
            title: 'Edit Annotation - Campus Navigator',
            mode: 'edit',
            annotation,
            nodes,
            panoramas
        });
    } catch (error) {
        console.error('Annotation edit page error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

router.post('/annotations/:annotation_id/edit', async (req, res) => {
    try {
        const annotation = await Annotation.findByPk(req.params.annotation_id);
        if (!annotation) {
            req.flash('error', 'Annotation not found');
            return res.redirect('/annotations');
        }

        const { panorama, target_node, label, yaw, pitch, visible_radius, is_active } = req.body;

        await annotation.update({
            panorama_id: parseInt(panorama),
            target_node_id: target_node ? parseInt(target_node) : null,
            label,
            yaw: parseFloat(yaw),
            pitch: parseFloat(pitch),
            visible_radius: parseFloat(visible_radius || 10),
            is_active: is_active !== 'off'
        });

        req.flash('success', 'Annotation updated successfully!');
        res.redirect('/annotations');
    } catch (error) {
        console.error('Annotation update error:', error);
        req.flash('error', `Error updating annotation: ${error.message}`);
        res.redirect(`/annotations/${req.params.annotation_id}/edit`);
    }
});

router.get('/annotations/:annotation_id/delete', async (req, res) => {
    try {
        const annotation = await Annotation.findByPk(req.params.annotation_id, {
            include: [
                { model: Nodes, as: 'panorama' },
                { model: Nodes, as: 'target_node' }
            ]
        });
        if (!annotation) {
            req.flash('error', 'Annotation not found');
            return res.redirect('/annotations');
        }
        res.render('annotation_confirm_delete', { title: 'Delete Annotation', annotation });
    } catch (error) {
        console.error('Annotation delete page error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

router.post('/annotations/:annotation_id/delete', async (req, res) => {
    try {
        const annotation = await Annotation.findByPk(req.params.annotation_id);
        if (!annotation) {
            req.flash('error', 'Annotation not found');
            return res.redirect('/annotations');
        }

        const label = annotation.label;
        await annotation.destroy();
        
        req.flash('success', `Annotation "${label}" deleted successfully!`);
        res.redirect('/annotations');
    } catch (error) {
        console.error('Annotation delete error:', error);
        req.flash('error', `Error deleting annotation: ${error.message}`);
        res.redirect('/annotations');
    }
});

// ============= Pathfinding Test Page =============
router.get('/pathfinding', async (req, res) => {
    try {
        const [nodes, campusMap] = await Promise.all([
            Nodes.findAll({ order: [['building', 'ASC'], ['name', 'ASC']] }),
            CampusMap.findOne({ where: { is_active: true } })
        ]);

        res.render('pathfinding_test', {
            title: 'Pathfinding Test - Campus Navigator',
            nodes,
            campus_map: campusMap
        });
    } catch (error) {
        console.error('Pathfinding page error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

// ============= Map Viewer =============
router.get('/map-viewer', async (req, res) => {
    try {
        const [campusMap, nodes, totalNodes, positionedNodes, buildings, floors] = await Promise.all([
            CampusMap.findOne({ where: { is_active: true } }),
            Nodes.findAll({ order: [['building', 'ASC'], ['name', 'ASC']] }),
            Nodes.count(),
            Nodes.count({ where: { map_x: { [Op.not]: null }, map_y: { [Op.not]: null } } }),
            Nodes.findAll({ attributes: ['building'], group: ['building'], order: [['building', 'ASC']], raw: true }),
            Nodes.findAll({ attributes: ['floor_level'], group: ['floor_level'], order: [['floor_level', 'ASC']], raw: true })
        ]);

        res.render('map_viewer', {
            title: 'Map Viewer - Campus Navigator',
            campus_map: campusMap,
            nodes,
            total_nodes: totalNodes,
            positioned_nodes: positionedNodes,
            buildings: buildings.map(b => b.building),
            floors: floors.map(f => f.floor_level)
        });
    } catch (error) {
        console.error('Map viewer error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

module.exports = router;
