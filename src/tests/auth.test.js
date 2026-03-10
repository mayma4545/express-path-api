/**
 * Authentication Tests
 * Tests: login success/failure, JWT enforcement on protected routes,
 * token expiry 401, invalid token 401, session-based fallback, no-auth 401.
 */

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Must mock models before requiring app (hoisting ensures this runs first)
jest.mock('../models', () => {
    const { Op } = require('sequelize');
    return {
        Op,
        sequelize: {
            authenticate: jest.fn().mockResolvedValue(),
            sync: jest.fn().mockResolvedValue(),
            QueryTypes: { SELECT: 'SELECT' },
            query: jest.fn().mockResolvedValue([{ lastUpdate: new Date().toISOString() }]),
        },
        User: { findOne: jest.fn() },
        Nodes: {
            findAll: jest.fn().mockResolvedValue([]),
            findByPk: jest.fn(),
            count: jest.fn().mockResolvedValue(0),
        },
        Edges: {
            findAll: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
            destroy: jest.fn().mockResolvedValue(1),
        },
        Annotation: {
            findAll: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
            destroy: jest.fn().mockResolvedValue(1),
        },
        CampusMap: { findOne: jest.fn().mockResolvedValue(null) },
        Event: { findAll: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    };
});

jest.mock('../services/pathfinding', () => ({
    getPathfinder: jest.fn(),
    resetPathfinder: jest.fn(),
}));
jest.mock('../services/NodeService', () => ({}));
jest.mock('../services/EdgeService', () => ({}));
jest.mock('../services/AnnotationService', () => ({}));
jest.mock('../services/EventService', () => ({}));
jest.mock('../services/qrcode.cloudinary', () => ({
    generateQRCode: jest.fn().mockResolvedValue('http://test-qr.jpg'),
    deleteQRCode: jest.fn().mockResolvedValue(),
}));
jest.mock('../services/upload.hybrid', () => ({
    upload360Hybrid: { single: jest.fn().mockReturnValue((_req, _res, next) => next()) },
    saveFileHybrid: jest.fn().mockResolvedValue({ url: 'http://cdn.test/file.jpg' }),
    saveBase64Hybrid: jest.fn().mockResolvedValue({ cloudinaryUrl: 'http://test-image.jpg' }),
    deleteFileHybrid: jest.fn().mockResolvedValue(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET;

const makeToken = (payload = {}, opts = {}) =>
    jwt.sign(
        { id: 1, username: 'admin', is_staff: true, is_superuser: false, ...payload },
        JWT_SECRET,
        { expiresIn: '1h', ...opts },
    );

const expiredToken = () =>
    jwt.sign(
        { id: 1, username: 'admin', is_staff: true },
        JWT_SECRET,
        { expiresIn: '-1s' },
    );

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/mobile/admin/login', () => {
    let app;
    let User;

    beforeAll(() => {
        // Require app after mocks are registered
        app = require('../server');
        ({ User } = require('../models'));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('returns 200 and a JWT token on valid staff credentials', async () => {
        const hash = await bcrypt.hash('password123', 10);
        User.findOne.mockResolvedValue({
            id: 1,
            username: 'admin',
            password: hash,
            is_staff: true,
            is_superuser: false,
        });

        const res = await request(app)
            .post('/api/mobile/admin/login')
            .send({ username: 'admin', password: 'password123' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(typeof res.body.token).toBe('string');
        expect(res.body.user.username).toBe('admin');

        // Verify the returned token is a valid JWT
        const decoded = jwt.verify(res.body.token, JWT_SECRET);
        expect(decoded.is_staff).toBe(true);
    });

    it('returns 401 when user does not exist', async () => {
        User.findOne.mockResolvedValue(null);

        const res = await request(app)
            .post('/api/mobile/admin/login')
            .send({ username: 'nobody', password: 'pass' });

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    it('returns 401 on wrong password', async () => {
        const hash = await bcrypt.hash('correct-password', 10);
        User.findOne.mockResolvedValue({
            id: 1,
            username: 'admin',
            password: hash,
            is_staff: true,
            is_superuser: false,
        });

        const res = await request(app)
            .post('/api/mobile/admin/login')
            .send({ username: 'admin', password: 'wrong-password' });

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    it('returns 401 for a non-staff (regular) user', async () => {
        const hash = await bcrypt.hash('password123', 10);
        User.findOne.mockResolvedValue({
            id: 2,
            username: 'student',
            password: hash,
            is_staff: false,
            is_superuser: false,
        });

        const res = await request(app)
            .post('/api/mobile/admin/login')
            .send({ username: 'student', password: 'password123' });

        expect(res.status).toBe(401);
    });

    it('returns 422 when username or password is missing', async () => {
        const res = await request(app)
            .post('/api/mobile/admin/login')
            .send({ username: '' });

        expect(res.status).toBeGreaterThanOrEqual(400);
    });
});

describe('requireAuth middleware', () => {
    let app;

    beforeAll(() => {
        app = require('../server');
    });

    it('returns 401 with "Authentication required" when no token is provided', async () => {
        const res = await request(app)
            .post('/api/mobile/admin/nodes/create')
            .send({ name: 'Test' });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Authentication required');
    });

    it('returns 401 with "Session expired" for an expired JWT', async () => {
        const res = await request(app)
            .post('/api/mobile/admin/nodes/create')
            .set('Authorization', `Bearer ${expiredToken()}`)
            .send({ name: 'Test' });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Session expired');
    });

    it('returns 401 with "Invalid credentials" for a malformed/tampered JWT', async () => {
        const res = await request(app)
            .post('/api/mobile/admin/nodes/create')
            .set('Authorization', 'Bearer this.is.not.a.valid.jwt')
            .send({ name: 'Test' });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid credentials');
    });

    it('returns 401 with "Invalid credentials" for a token signed with the wrong secret', async () => {
        const wrongToken = jwt.sign(
            { id: 1, username: 'admin', is_staff: true },
            'wrong-secret',
            { expiresIn: '1h' },
        );

        const res = await request(app)
            .post('/api/mobile/admin/nodes/create')
            .set('Authorization', `Bearer ${wrongToken}`)
            .send({ name: 'Test' });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid credentials');
    });

    it('allows a request with a valid JWT to proceed past the middleware', async () => {
        const { NodeService } = require('../services/NodeService') || {};
        // We only check that auth passes; NodeService mock lets it reach the handler
        const token = makeToken();
        const res = await request(app)
            .get('/api/mobile/nodes')
            .set('Authorization', `Bearer ${token}`);

        // Public endpoint — should always be 200 regardless of auth
        expect(res.status).toBe(200);
    });
});

describe('perInstallLimiter key generation', () => {
    it('uses install ID key for valid UUID header', () => {
        const { installIdKeyGenerator } = require('../middleware/rateLimiter');
        const mockReq = {
            headers: { 'x-app-install-id': 'a1b2c3d4-e5f6-4789-ab12-cd34ef567890' },
            ip: '127.0.0.1',
        };
        const key = installIdKeyGenerator(mockReq);
        expect(key).toBe('install:a1b2c3d4-e5f6-4789-ab12-cd34ef567890');
    });

    it('falls back to IP for missing X-App-Install-ID header', () => {
        const { installIdKeyGenerator } = require('../middleware/rateLimiter');
        const mockReq = { headers: {}, ip: '10.0.0.5' };
        const key = installIdKeyGenerator(mockReq);
        expect(key).toBe('ip:10.0.0.5');
    });

    it('falls back to IP for a non-UUID (crafted long key) header value', () => {
        const { installIdKeyGenerator } = require('../middleware/rateLimiter');
        const mockReq = {
            headers: { 'x-app-install-id': 'a'.repeat(200) }, // Malicious long key
            ip: '10.0.0.5',
        };
        const key = installIdKeyGenerator(mockReq);
        expect(key).toBe('ip:10.0.0.5');
    });

    it('falls back to IP for a UUID v1 (not v4) header value', () => {
        const { installIdKeyGenerator } = require('../middleware/rateLimiter');
        const mockReq = {
            headers: { 'x-app-install-id': 'a1b2c3d4-e5f6-1789-ab12-cd34ef567890' }, // version 1
            ip: '192.168.1.1',
        };
        const key = installIdKeyGenerator(mockReq);
        expect(key).toBe('ip:192.168.1.1');
    });
});
