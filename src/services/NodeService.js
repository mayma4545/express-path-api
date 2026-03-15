/**
 * Node Service
 * Business logic for node CRUD operations
 * Extracted from routes to eliminate duplication
 */

const { Op } = require('sequelize');
const { Nodes, Edges, Annotation } = require('../models');
const { getPathfinder, resetPathfinder } = require('./pathfinding');
const { generateQRCode, deleteQRCode } = require('./qrcode.cloudinary');
const { saveBase64Hybrid, deleteFileHybrid, saveFileHybrid } = require('./upload.hybrid');
const { logger } = require('../utils/logger');

class NodeService {
    /**
     * Get all nodes with optional filtering
     */
    async getNodes(filters = {}) {
        const { search, building, floor } = filters;

        const where = {};
        if (search) {
            where[Op.or] = [
                { node_code: { [Op.like]: `%${search}%` } },
                { name: { [Op.like]: `%${search}%` } },
                { building: { [Op.like]: `%${search}%` } },
            ];
        }
        if (building) where.building = building;
        if (floor) where.floor_level = parseInt(floor);

        const nodes = await Nodes.findAll({
            where,
            order: [['building', 'ASC'], ['floor_level', 'ASC'], ['name', 'ASC']],
        });

        return nodes;
    }

    /**
     * Get a single node by ID with annotations
     */
    async getNodeById(nodeId, includeAnnotations = false) {
        const node = await Nodes.findByPk(nodeId);

        if (!node) {
            return null;
        }

        if (includeAnnotations) {
            const annotations = await Annotation.findAll({
                where: { panorama_id: node.node_id, is_active: true },
                include: [{ model: Nodes, as: 'target_node' }],
            });
            return { node, annotations };
        }

        return { node };
    }

    /**
     * Get unique buildings list
     */
    async getBuildings() {
        const buildings = await Nodes.findAll({
            attributes: ['building'],
            group: ['building'],
            order: [['building', 'ASC']],
            raw: true,
        });
        return buildings.map(b => b.building);
    }

    /**
     * Get unique floor levels
     */
    async getFloors() {
        const floors = await Nodes.findAll({
            attributes: ['floor_level'],
            group: ['floor_level'],
            order: [['floor_level', 'ASC']],
            raw: true,
        });
        return floors.map(f => f.floor_level);
    }

    /**
     * Generate a unique node code from building and floor.
     * Format: {BLD}-F{N}-{RAND4}  e.g. ENG-F2-3K9A
     * Basement floors use B prefix: ENG-B1-3K9A
     */
    generateNodeCode(building, floor_level) {
        const prefix = (building || 'NOD')
            .trim()
            .split(/\s+/)
            .map(w => (w[0] || '').toUpperCase())
            .join('')
            .substring(0, 3) || 'NOD';

        const floorNum = parseInt(floor_level) || 1;
        const floorPart = floorNum < 0 ? `B${Math.abs(floorNum)}` : `F${floorNum}`;

        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const suffix = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

        return `${prefix}-${floorPart}-${suffix}`;
    }

    /**
     * Create a new node
     */
    async createNode(data, imageBase64 = null, imageFile = null) {
        let { node_code, name, building, floor_level, type_of_node, description, map_x, map_y, annotation } = data;

        // Auto-generate a unique node_code if not supplied
        if (!node_code) {
            node_code = this.generateNodeCode(building, floor_level);
        }

        const node = await Nodes.create({
            node_code,
            name,
            building,
            floor_level: parseInt(floor_level),
            type_of_node: type_of_node || 'room',
            description: description || '',
            map_x: map_x ? parseFloat(map_x) : null,
            map_y: map_y ? parseFloat(map_y) : null,
            annotation: annotation !== undefined && annotation !== '' ? parseFloat(annotation) : null,
        });

        // Handle base64 image (from mobile API)
        if (imageBase64) {
            try {
                const { cloudinaryUrl } = await saveBase64Hybrid(imageBase64, `${node.node_code}_360.jpg`, '360_images');
                await node.update({ image360: cloudinaryUrl });
            } catch (imgErr) {
                logger.warn(`360 image upload failed for node ${node.node_code}: ${imgErr.message}`);
            }
        }

        // Handle file upload (from web form)
        if (imageFile) {
            try {
                const { cloudinaryUrl } = await saveFileHybrid(imageFile, '360_images');
                await node.update({ image360: cloudinaryUrl });
            } catch (imgErr) {
                logger.warn(`360 image file upload failed for node ${node.node_code}: ${imgErr.message}`);
            }
        }

        // Generate QR code (non-fatal – node creation succeeds even if Cloudinary is misconfigured)
        try {
            const qrcodeUrl = await generateQRCode(node);
            await node.update({ qrcode: qrcodeUrl });
        } catch (qrErr) {
            logger.warn(`QR code generation failed for node ${node.node_code}: ${qrErr.message}`);
        }

        resetPathfinder();
        logger.info(`Node created: ${node.node_code}`, { nodeId: node.node_id });

        return node;
    }

    /**
     * Update an existing node
     */
    async updateNode(nodeId, data, imageBase64 = null, imageFile = null, regenerateQR = false) {
        const node = await Nodes.findByPk(nodeId);

        if (!node) {
            return null;
        }

        const oldNodeCode = node.node_code;
        const { node_code, name, building, floor_level, type_of_node, description, map_x, map_y, annotation } = data;

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

        if (annotation !== undefined) {
            if (annotation === null || annotation === '') {
                updateData.annotation = null;
            } else {
                const parsed = parseFloat(annotation);
                updateData.annotation = isNaN(parsed) ? null : parsed;
            }
        }

        if (map_x !== undefined && map_y !== undefined) {
            updateData.map_x = map_x === null || map_x === '' ? null : parseFloat(map_x);
            updateData.map_y = map_y === null || map_y === '' ? null : parseFloat(map_y);
        }

        // Handle base64 image update (from mobile API)
        if (imageBase64) {
            if (node.image360) await deleteFileHybrid(null, node.image360);
            const timestamp = Date.now();
            const { cloudinaryUrl } = await saveBase64Hybrid(imageBase64, `${node_code || node.node_code}_360_${timestamp}.jpg`, '360_images');
            updateData.image360 = cloudinaryUrl;
        }

        // Handle file upload update (from web form)
        if (imageFile) {
            if (node.image360) await deleteFileHybrid(null, node.image360);
            const { cloudinaryUrl } = await saveFileHybrid(imageFile, '360_images');
            updateData.image360 = cloudinaryUrl;
        }

        await node.update(updateData);
        await node.reload();

        // Regenerate QR code if node_code changed
        if (regenerateQR || (node_code && node_code !== oldNodeCode)) {
            if (node.qrcode) await deleteQRCode(node.qrcode);
            const qrcodeUrl = await generateQRCode(node);
            await node.update({ qrcode: qrcodeUrl });
        }

        resetPathfinder();
        logger.info(`Node updated: ${node.node_code}`, { nodeId: node.node_id });

        return node;
    }

    /**
     * Delete a node and all related data
     */
    async deleteNode(nodeId) {
        const node = await Nodes.findByPk(nodeId);

        if (!node) {
            return null;
        }

        const nodeCode = node.node_code;
        const nodeName = node.name;

        // Delete all related edges (both from and to this node)
        await Edges.destroy({
            where: {
                [Op.or]: [
                    { from_node_id: node.node_id },
                    { to_node_id: node.node_id },
                ],
            },
        });

        // Delete all related annotations
        await Annotation.destroy({
            where: {
                [Op.or]: [
                    { panorama_id: node.node_id },
                    { target_node_id: node.node_id },
                ],
            },
        });

        // Delete associated files from both Cloudinary and local storage
        if (node.image360) {
            logger.info(`Deleting 360° image: ${node.image360}`);
            await deleteFileHybrid(null, node.image360);
        }
        if (node.qrcode) {
            logger.info(`Deleting QR code: ${node.qrcode}`);
            await deleteQRCode(node.qrcode);
        }

        // Now safe to delete the node
        await node.destroy();
        resetPathfinder();

        logger.info(`Node deleted: ${nodeCode}`, { nodeName });

        return { nodeCode, nodeName };
    }

    /**
     * Get dashboard statistics
     */
    async getStats() {
        const [totalNodes, buildings] = await Promise.all([
            Nodes.count(),
            this.getBuildings(),
        ]);

        return { totalNodes, buildingsCount: buildings.length, buildings };
    }
}

module.exports = new NodeService();
