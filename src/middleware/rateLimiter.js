/**
 * Rate Limiting Middleware
 * Protects API from abuse
 */

const rateLimit = require('express-rate-limit');
const { RATE_LIMIT } = require('../utils/constants');

// Standard API rate limiter
const apiLimiter = rateLimit({
    windowMs: RATE_LIMIT.WINDOW_MS,
    max: RATE_LIMIT.MAX_REQUESTS,
    message: {
        success: false,
        error: 'Too many requests, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Stricter limiter for authentication endpoints
const authLimiter = rateLimit({
    windowMs: RATE_LIMIT.WINDOW_MS,
    max: RATE_LIMIT.AUTH_MAX_ATTEMPTS,
    message: {
        success: false,
        error: 'Too many login attempts, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Only count failed attempts
});

module.exports = {
    apiLimiter,
    authLimiter,
};
