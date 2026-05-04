/**
 * API Routes - Internal Web API
 * Mirrors Django views.py API endpoints
 */

const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Nodes, Edges, Annotation, CampusMap } = require('../models');
const { getPathfinder } = require('../services/pathfinding');

// Find path between two nodes
router.post('/find-path', async (req, res) => {
    try {
        const { start, goal, avoid_stairs } = req.body;

        if (!start || !goal) {
            return res.status(400).json({ error: 'Start and goal codes required' });
        }

        const pathfinder = getPathfinder();
        const result = await pathfinder.getDirections(start, goal, avoid_stairs || false);

        res.json(result);
    } catch (error) {
        console.error('Find path error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get annotations for a panorama node
router.get('/annotations/:node_id', async (req, res) => {
    try {
        const annotations = await Annotation.findAll({
            where: {
                panorama_id: req.params.node_id,
                is_active: true
            },
            include: [{ model: Nodes, as: 'target_node' }]
        });

        const data = annotations.map(a => ({
            id: a.id,
            label: a.label,
            yaw: a.yaw,
            pitch: a.pitch,
            visible_radius: a.visible_radius,
            target_node: a.target_node ? {
                node_id: a.target_node.node_id,
                name: a.target_node.name,
                building: a.target_node.building
            } : null
        }));

        res.json({ annotations: data });
    } catch (error) {
        console.error('Get annotations error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get node details
router.get('/node-details/:node_id', async (req, res) => {
    try {
        const node = await Nodes.findByPk(req.params.node_id);
        
        if (!node) {
            return res.status(404).json({ error: 'Node not found' });
        }

        res.json({
            node_id: node.node_id,
            node_code: node.node_code,
            name: node.name,
            building: node.building,
            floor_level: node.floor_level,
            type_of_node: node.type_of_node,
            map_x: node.map_x !== null ? parseFloat(node.map_x) : null,
            map_y: node.map_y !== null ? parseFloat(node.map_y) : null,
            qrcode: node.qrcode || null,
            image360: node.image360 || null
        });
    } catch (error) {
        console.error('Get node details error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get graph visualization data
router.get('/graph-data', async (req, res) => {
    try {
        const [nodes, edges] = await Promise.all([
            Nodes.findAll(),
            Edges.findAll({
                where: { is_active: true },
                include: [
                    { model: Nodes, as: 'from_node' },
                    { model: Nodes, as: 'to_node' }
                ]
            })
        ]);

        const nodesData = nodes.map(n => ({
            id: n.node_id,
            code: n.node_code,
            name: n.name,
            building: n.building,
            floor: n.floor_level,
            type: n.type_of_node,
            map_x: n.map_x !== null ? parseFloat(n.map_x) : null,
            map_y: n.map_y !== null ? parseFloat(n.map_y) : null
        }));

        const edgesData = edges.map(e => ({
            id: e.edge_id,
            from: e.from_node_id,
            to: e.to_node_id,
            distance: e.distance,
            compass: e.compass_angle,
            staircase: e.is_staircase,
            active: e.is_active
        }));

        res.json({ nodes: nodesData, edges: edgesData });
    } catch (error) {
        console.error('Get graph data error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
