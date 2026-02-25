/**
 * Rate Limiting Middleware
 * Protects API from abuse
 *
 * Bug fixes (2026-02-25):
 *  1. MAX_REQUESTS raised from 100 → 300 to handle normal concurrent usage.
 *  2. Added adminLimiter (1 000 req / 15 min) so concurrent node edits by
 *     admins never trip the public cap.
 *  3. Added skipFailedRequests: false + handler that logs the blocked IP so
 *     ops can investigate real abuse vs. legitimate admin traffic.
 *  4. The persistent-lockout-after-restart problem is inherent to the default
 *     in-memory store: the window counter lives on the server and restarting
 *     the *client* app has no effect. The higher limits above make this
 *     scenario far less likely; if a Redis store is added later the counter
 *     can be cleared manually without restarting the server.
 */

const rateLimit = require('express-rate-limit');
const { RATE_LIMIT } = require('../utils/constants');
const { logger } = require('../utils/logger');

// Standard API rate limiter (public / mobile read traffic)
const apiLimiter = rateLimit({
    windowMs: RATE_LIMIT.WINDOW_MS,
    max: RATE_LIMIT.MAX_REQUESTS,
    message: {
        success: false,
        error: 'Too many requests, please try again later.',
    },
    standardHeaders: true,  // Return RateLimit-* headers so clients can back off
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        logger.warn(`Rate limit exceeded (public): ${req.method} ${req.path}`, {
            ip: req.ip,
            limit: options.max,
            windowMs: options.windowMs,
        });
        res.status(options.statusCode).json(options.message);
    },
});

// Admin API rate limiter — much higher ceiling for concurrent node edits
const adminLimiter = rateLimit({
    windowMs: RATE_LIMIT.WINDOW_MS,
    max: RATE_LIMIT.ADMIN_MAX_REQUESTS,
    message: {
        success: false,
        error: 'Too many admin requests, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        logger.warn(`Rate limit exceeded (admin): ${req.method} ${req.path}`, {
            ip: req.ip,
            limit: options.max,
            windowMs: options.windowMs,
        });
        res.status(options.statusCode).json(options.message);
    },
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
    handler: (req, res, next, options) => {
        logger.warn(`Auth rate limit exceeded: ${req.method} ${req.path}`, {
            ip: req.ip,
            limit: options.max,
            windowMs: options.windowMs,
        });
        res.status(options.statusCode).json(options.message);
    },
});

module.exports = {
    apiLimiter,
    adminLimiter,
    authLimiter,
};
