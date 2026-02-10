/**
 * Annotation Service
 * Business logic for annotation CRUD operations
 */

const { Nodes, Annotation } = require('../models');
const { logger } = require('../utils/logger');

class AnnotationService {
    /**
     * Get all annotations with optional filtering
     */
    async getAnnotations(panoramaId = null) {
        const where = {};
        if (panoramaId) where.panorama_id = parseInt(panoramaId);

        const annotations = await Annotation.findAll({
            where,
            include: [
                { model: Nodes, as: 'panorama' },
                { model: Nodes, as: 'target_node' },
            ],
            order: [['panorama_id', 'ASC'], ['yaw', 'ASC']],
        });

        return annotations;
    }

    /**
     * Get a single annotation by ID
     */
    async getAnnotationById(annotationId) {
        const annotation = await Annotation.findByPk(annotationId, {
            include: [
                { model: Nodes, as: 'panorama' },
                { model: Nodes, as: 'target_node' },
            ],
        });
        return annotation;
    }

    /**
     * Get panoramas (nodes with 360° images)
     */
    async getPanoramas() {
        const { Op } = require('sequelize');
        const panoramas = await Nodes.findAll({
            where: { image360: { [Op.not]: null } },
            order: [['name', 'ASC']],
        });
        return panoramas;
    }

    /**
     * Create a new annotation
     */
    async createAnnotation(data) {
        const { panorama_id, target_node_id, label, yaw, pitch, visible_radius, is_active } = data;

        // Validate panorama exists
        const panorama = await Nodes.findByPk(panorama_id);
        if (!panorama) {
            throw new Error('Panorama node not found');
        }

        // Validate target node if provided
        if (target_node_id) {
            const targetNode = await Nodes.findByPk(target_node_id);
            if (!targetNode) {
                throw new Error('Target node not found');
            }
        }

        const annotation = await Annotation.create({
            panorama_id: parseInt(panorama_id),
            target_node_id: target_node_id ? parseInt(target_node_id) : null,
            label,
            yaw: parseFloat(yaw),
            pitch: parseFloat(pitch),
            visible_radius: parseFloat(visible_radius || 10),
            is_active: is_active !== false && is_active !== 'off',
        });

        logger.info(`Annotation created: ${label}`, { annotationId: annotation.id, panoramaId: panorama_id });

        return annotation;
    }

    /**
     * Update an existing annotation
     */
    async updateAnnotation(annotationId, data) {
        const annotation = await Annotation.findByPk(annotationId);

        if (!annotation) {
            return null;
        }

        const { panorama_id, target_node_id, label, yaw, pitch, visible_radius, is_active } = data;
        const updateData = {};

        // Validate and update panorama_id
        if (panorama_id !== undefined) {
            const panorama = await Nodes.findByPk(panorama_id);
            if (!panorama) throw new Error('Panorama node not found');
            updateData.panorama_id = parseInt(panorama_id);
        }

        // Validate and update target_node_id
        if (target_node_id !== undefined) {
            if (target_node_id) {
                const targetNode = await Nodes.findByPk(target_node_id);
                if (!targetNode) throw new Error('Target node not found');
                updateData.target_node_id = parseInt(target_node_id);
            } else {
                updateData.target_node_id = null;
            }
        }

        if (label !== undefined) updateData.label = label;
        if (yaw !== undefined) updateData.yaw = parseFloat(yaw);
        if (pitch !== undefined) updateData.pitch = parseFloat(pitch);
        if (visible_radius !== undefined) updateData.visible_radius = parseFloat(visible_radius);
        if (is_active !== undefined) updateData.is_active = is_active !== false && is_active !== 'off';

        await annotation.update(updateData);

        logger.info(`Annotation updated`, { annotationId: annotation.id });

        return annotation;
    }

    /**
     * Delete an annotation
     */
    async deleteAnnotation(annotationId) {
        const annotation = await Annotation.findByPk(annotationId);

        if (!annotation) {
            return null;
        }

        const label = annotation.label;
        await annotation.destroy();

        logger.info(`Annotation deleted: ${label}`, { annotationId });

        return { label };
    }

    /**
     * Get annotation statistics
     */
    async getStats() {
        const [totalAnnotations, activeAnnotations] = await Promise.all([
            Annotation.count(),
            Annotation.count({ where: { is_active: true } }),
        ]);

        return { totalAnnotations, activeAnnotations };
    }
}

module.exports = new AnnotationService();
