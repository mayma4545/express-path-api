/**
 * Application Constants
 * Centralized configuration values to replace magic numbers
 */

module.exports = {
    // Session configuration
    SESSION: {
        MAX_AGE_MS: 24 * 60 * 60 * 1000, // 24 hours
        COOKIE_NAME: 'campus.sid',
    },

    // JWT configuration
    JWT: {
        EXPIRES_IN: '24h',
        ISSUER: 'campus-nav-api',
    },

    // Rate limiting
    RATE_LIMIT: {
        WINDOW_MS: 15 * 60 * 1000, // 15 minutes
        MAX_REQUESTS: 100,
        AUTH_MAX_ATTEMPTS: 5,
    },

    // Pathfinding
    PATHFINDING: {
        METERS_PER_FLOOR: 4.0, // Assumed height per floor level
    },

    // Validation limits
    VALIDATION: {
        NODE_CODE_MAX: 50,
        NAME_MAX: 255,
        BUILDING_MAX: 255,
        FLOOR_MIN: -10,
        FLOOR_MAX: 200,
        DESCRIPTION_MAX: 5000,
        MAP_COORD_MIN: 0.0,
        MAP_COORD_MAX: 100.0,
        YAW_MIN: -180.0,
        YAW_MAX: 180.0,
        PITCH_MIN: -90.0,
        PITCH_MAX: 90.0,
        VISIBLE_RADIUS_MAX: 180.0,
    },

    // Node types
    NODE_TYPES: ['room', 'hallway', 'entrance', 'exit', 'staircase', 'elevator', 'restroom', 'office'],

    // Upload limits
    UPLOAD: {
        MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
        ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    },
};
