/**
 * Input Validation Middleware
 * Using express-validator for request validation
 */

const { body, param, query, validationResult } = require('express-validator');
const { VALIDATION, NODE_TYPES } = require('../utils/constants');

// Generic validation result handler
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors.array().map(err => ({
                field: err.path,
                message: err.msg,
            })),
        });
    }
    next();
};

// Node validation rules
const nodeValidation = {
    create: [
        body('node_code')
            .trim()
            .notEmpty().withMessage('Node code is required')
            .isLength({ max: VALIDATION.NODE_CODE_MAX }).withMessage(`Node code must be ${VALIDATION.NODE_CODE_MAX} characters or less`),
        body('name')
            .trim()
            .notEmpty().withMessage('Name is required')
            .isLength({ max: VALIDATION.NAME_MAX }).withMessage(`Name must be ${VALIDATION.NAME_MAX} characters or less`),
        body('building')
            .trim()
            .notEmpty().withMessage('Building is required')
            .isLength({ max: VALIDATION.BUILDING_MAX }).withMessage(`Building must be ${VALIDATION.BUILDING_MAX} characters or less`),
        body('floor_level')
            .notEmpty().withMessage('Floor level is required')
            .isInt({ min: VALIDATION.FLOOR_MIN, max: VALIDATION.FLOOR_MAX })
            .withMessage(`Floor level must be between ${VALIDATION.FLOOR_MIN} and ${VALIDATION.FLOOR_MAX}`),
        body('type_of_node')
            .optional()
            .isIn(NODE_TYPES).withMessage(`Type must be one of: ${NODE_TYPES.join(', ')}`),
        body('description')
            .optional()
            .isLength({ max: VALIDATION.DESCRIPTION_MAX }).withMessage(`Description must be ${VALIDATION.DESCRIPTION_MAX} characters or less`),
        body('map_x')
            .optional()
            .isFloat({ min: VALIDATION.MAP_COORD_MIN, max: VALIDATION.MAP_COORD_MAX })
            .withMessage(`map_x must be between ${VALIDATION.MAP_COORD_MIN} and ${VALIDATION.MAP_COORD_MAX}`),
        body('map_y')
            .optional()
            .isFloat({ min: VALIDATION.MAP_COORD_MIN, max: VALIDATION.MAP_COORD_MAX })
            .withMessage(`map_y must be between ${VALIDATION.MAP_COORD_MIN} and ${VALIDATION.MAP_COORD_MAX}`),
        validate,
    ],
    update: [
        param('node_id').isInt().withMessage('Invalid node ID'),
        body('node_code')
            .optional()
            .trim()
            .isLength({ max: VALIDATION.NODE_CODE_MAX }).withMessage(`Node code must be ${VALIDATION.NODE_CODE_MAX} characters or less`),
        body('name')
            .optional()
            .trim()
            .isLength({ max: VALIDATION.NAME_MAX }).withMessage(`Name must be ${VALIDATION.NAME_MAX} characters or less`),
        body('floor_level')
            .optional()
            .isInt({ min: VALIDATION.FLOOR_MIN, max: VALIDATION.FLOOR_MAX })
            .withMessage(`Floor level must be between ${VALIDATION.FLOOR_MIN} and ${VALIDATION.FLOOR_MAX}`),
        validate,
    ],
    delete: [
        param('node_id').isInt().withMessage('Invalid node ID'),
        validate,
    ],
};

// Edge validation rules
const edgeValidation = {
    create: [
        body('from_node_id')
            .notEmpty().withMessage('From node ID is required')
            .isInt().withMessage('From node ID must be an integer'),
        body('to_node_id')
            .notEmpty().withMessage('To node ID is required')
            .isInt().withMessage('To node ID must be an integer'),
        body('distance')
            .notEmpty().withMessage('Distance is required')
            .isFloat({ min: 0 }).withMessage('Distance must be a positive number'),
        body('compass_angle')
            .notEmpty().withMessage('Compass angle is required')
            .isFloat({ min: 0, max: 360 }).withMessage('Compass angle must be between 0 and 360'),
        body('is_staircase')
            .optional()
            .isBoolean().withMessage('is_staircase must be a boolean'),
        body('is_active')
            .optional()
            .isBoolean().withMessage('is_active must be a boolean'),
        validate,
    ],
    update: [
        param('edge_id').isInt().withMessage('Invalid edge ID'),
        body('distance')
            .optional()
            .isFloat({ min: 0 }).withMessage('Distance must be a positive number'),
        body('compass_angle')
            .optional()
            .isFloat({ min: 0, max: 360 }).withMessage('Compass angle must be between 0 and 360'),
        validate,
    ],
    delete: [
        param('edge_id').isInt().withMessage('Invalid edge ID'),
        validate,
    ],
};

// Annotation validation rules
const annotationValidation = {
    create: [
        body('panorama_id')
            .notEmpty().withMessage('Panorama ID is required')
            .isInt().withMessage('Panorama ID must be an integer'),
        body('target_node_id')
            .optional({ nullable: true })
            .isInt().withMessage('Target node ID must be an integer'),
        body('label')
            .trim()
            .notEmpty().withMessage('Label is required')
            .isLength({ max: VALIDATION.NAME_MAX }).withMessage(`Label must be ${VALIDATION.NAME_MAX} characters or less`),
        body('yaw')
            .notEmpty().withMessage('Yaw is required')
            .isFloat({ min: VALIDATION.YAW_MIN, max: VALIDATION.YAW_MAX })
            .withMessage(`Yaw must be between ${VALIDATION.YAW_MIN} and ${VALIDATION.YAW_MAX}`),
        body('pitch')
            .notEmpty().withMessage('Pitch is required')
            .isFloat({ min: VALIDATION.PITCH_MIN, max: VALIDATION.PITCH_MAX })
            .withMessage(`Pitch must be between ${VALIDATION.PITCH_MIN} and ${VALIDATION.PITCH_MAX}`),
        body('visible_radius')
            .optional()
            .isFloat({ min: 0, max: VALIDATION.VISIBLE_RADIUS_MAX })
            .withMessage(`Visible radius must be between 0 and ${VALIDATION.VISIBLE_RADIUS_MAX}`),
        validate,
    ],
    update: [
        param('annotation_id').isInt().withMessage('Invalid annotation ID'),
        body('yaw')
            .optional()
            .isFloat({ min: VALIDATION.YAW_MIN, max: VALIDATION.YAW_MAX })
            .withMessage(`Yaw must be between ${VALIDATION.YAW_MIN} and ${VALIDATION.YAW_MAX}`),
        body('pitch')
            .optional()
            .isFloat({ min: VALIDATION.PITCH_MIN, max: VALIDATION.PITCH_MAX })
            .withMessage(`Pitch must be between ${VALIDATION.PITCH_MIN} and ${VALIDATION.PITCH_MAX}`),
        validate,
    ],
    delete: [
        param('annotation_id').isInt().withMessage('Invalid annotation ID'),
        validate,
    ],
};

// Pathfinding validation
const pathfindingValidation = [
    body('start_code')
        .trim()
        .notEmpty().withMessage('Start node code is required'),
    body('goal_code')
        .trim()
        .notEmpty().withMessage('Goal node code is required'),
    body('avoid_stairs')
        .optional()
        .isBoolean().withMessage('avoid_stairs must be a boolean'),
    validate,
];

// Login validation
const loginValidation = [
    body('username')
        .trim()
        .notEmpty().withMessage('Username is required'),
    body('password')
        .notEmpty().withMessage('Password is required'),
    validate,
];

module.exports = {
    validate,
    nodeValidation,
    edgeValidation,
    annotationValidation,
    pathfindingValidation,
    loginValidation,
};
