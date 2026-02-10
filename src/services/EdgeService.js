/**
 * Edge Service
 * Business logic for edge CRUD operations
 */

const { Nodes, Edges } = require('../models');
const { resetPathfinder } = require('./pathfinding');
const { logger } = require('../utils/logger');

class EdgeService {
    /**
     * Get all edges with optional filtering
     */
    async getEdges(filters = {}) {
        const { status, staircase } = filters;

        const where = {};
        if (status === 'active') where.is_active = true;
        else if (status === 'inactive') where.is_active = false;
        if (staircase === 'yes' || staircase === true) where.is_staircase = true;
        else if (staircase === 'no' || staircase === false) where.is_staircase = false;

        const edges = await Edges.findAll({
            where,
            include: [
                { model: Nodes, as: 'from_node' },
                { model: Nodes, as: 'to_node' },
            ],
            order: [['created_at', 'DESC']],
        });

        return edges;
    }

    /**
     * Get a single edge by ID
     */
    async getEdgeById(edgeId) {
        const edge = await Edges.findByPk(edgeId, {
            include: [
                { model: Nodes, as: 'from_node' },
                { model: Nodes, as: 'to_node' },
            ],
        });
        return edge;
    }

    /**
     * Create a new edge
     */
    async createEdge(data) {
        const { from_node_id, to_node_id, distance, compass_angle, is_staircase, is_active } = data;

        // Validate nodes exist
        const [fromNode, toNode] = await Promise.all([
            Nodes.findByPk(from_node_id),
            Nodes.findByPk(to_node_id),
        ]);

        if (!fromNode) {
            throw new Error('From node not found');
        }
        if (!toNode) {
            throw new Error('To node not found');
        }

        const edge = await Edges.create({
            from_node_id: parseInt(from_node_id),
            to_node_id: parseInt(to_node_id),
            distance: parseFloat(distance),
            compass_angle: parseFloat(compass_angle),
            is_staircase: is_staircase === true || is_staircase === 'on',
            is_active: is_active !== false && is_active !== 'off',
        });

        resetPathfinder();
        logger.info(`Edge created: ${fromNode.node_code} -> ${toNode.node_code}`, { edgeId: edge.edge_id });

        return edge;
    }

    /**
     * Update an existing edge
     */
    async updateEdge(edgeId, data) {
        const edge = await Edges.findByPk(edgeId);

        if (!edge) {
            return null;
        }

        const { from_node_id, to_node_id, distance, compass_angle, is_staircase, is_active } = data;
        const updateData = {};

        // Validate and update from_node_id
        if (from_node_id !== undefined) {
            const fromNode = await Nodes.findByPk(from_node_id);
            if (!fromNode) throw new Error('From node not found');
            updateData.from_node_id = parseInt(from_node_id);
        }

        // Validate and update to_node_id
        if (to_node_id !== undefined) {
            const toNode = await Nodes.findByPk(to_node_id);
            if (!toNode) throw new Error('To node not found');
            updateData.to_node_id = parseInt(to_node_id);
        }

        if (distance !== undefined) updateData.distance = parseFloat(distance);
        if (compass_angle !== undefined) updateData.compass_angle = parseFloat(compass_angle);
        if (is_staircase !== undefined) updateData.is_staircase = is_staircase === true || is_staircase === 'on';
        if (is_active !== undefined) updateData.is_active = is_active !== false && is_active !== 'off';

        await edge.update(updateData);
        resetPathfinder();

        logger.info(`Edge updated`, { edgeId: edge.edge_id });

        return edge;
    }

    /**
     * Delete an edge
     */
    async deleteEdge(edgeId) {
        const edge = await Edges.findByPk(edgeId);

        if (!edge) {
            return null;
        }

        await edge.destroy();
        resetPathfinder();

        logger.info(`Edge deleted`, { edgeId });

        return true;
    }

    /**
     * Get edge statistics
     */
    async getStats() {
        const [totalEdges, activeEdges, staircaseEdges] = await Promise.all([
            Edges.count(),
            Edges.count({ where: { is_active: true } }),
            Edges.count({ where: { is_staircase: true } }),
        ]);

        return { totalEdges, activeEdges, staircaseEdges };
    }
}

module.exports = new EdgeService();
