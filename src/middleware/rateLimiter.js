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
 *
 * 2026-03-10: Added perInstallLimiter — 5 req/sec per unique install ID.
 *  The mobile app sends a UUID in X-App-Install-ID on every request.
 *  This provides fair, per-device throttling even behind shared NAT/WiFi.
 *  Falls back to IP when the header is absent or malformed.
 */

const rateLimit = require('express-rate-limit');
const { RATE_LIMIT } = require('../utils/constants');
const { logger } = require('../utils/logger');

// UUID v4 format validator — prevents crafted long strings from bypassing the limiter
// by using an excessively long key. Only well-formed install IDs are accepted.
const INSTALL_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
        logger.warn(`[RATE LIMIT EXCEEDED] apiLimiter blocked request: ${req.method} ${req.path}`, {
            ip: req.ip,
            installId: req.headers['x-app-install-id'],
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

// Per-install-ID limiter: 5 requests per second per unique app installation.
// Key is the UUID sent by the mobile app via X-App-Install-ID header.
// This ensures fair usage even when many devices share the same IP (e.g. campus WiFi).

/**
 * Exported standalone so unit tests can call it directly (express-rate-limit
 * does not expose the keyGenerator function as a property on the middleware).
 */
const installIdKeyGenerator = (req) => {
    const installId = req.headers['x-app-install-id'];
    // Accept only valid UUID v4 values to prevent key-space abuse
    if (installId && INSTALL_ID_REGEX.test(installId)) {
        return `install:${installId}`;
    }
    // Fall back to IP for web browsers and non-app API clients
    return `ip:${req.ip}`;
};

const perInstallLimiter = rateLimit({
    windowMs: RATE_LIMIT.PER_INSTALL_WINDOW_MS,
    max: RATE_LIMIT.PER_INSTALL_MAX,
    // Skip entirely in test mode so Jest tests don't exhaust the per-second budget
    skip: () => process.env.NODE_ENV === 'test',
    keyGenerator: installIdKeyGenerator,
    // We intentionally fall back to req.ip for non-app clients.
    // Suppress express-rate-limit's IPv6 false-positive warning for this limiter.
    validate: { keyGeneratorIpFallback: false },
    message: {
        success: false,
        error: 'Too many requests. Please slow down.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        logger.warn(`[RATE LIMIT EXCEEDED] perInstallLimiter blocked request: ${req.method} ${req.path}`, {
            ip: req.ip,
            installId: req.headers['x-app-install-id'],
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
    perInstallLimiter,
    installIdKeyGenerator,
};
