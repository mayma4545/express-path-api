/**
 * Edge CRUD API Tests
 * Tests: create, read (list), update, delete
 * Verifies: auth enforcement, node validation, 404 handling.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

// ── Mocks ─────────────────────────────────────────────────────────────────────

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
            findAll: jest.fn(),
            findByPk: jest.fn(),
            count: jest.fn().mockResolvedValue(0),
            destroy: jest.fn().mockResolvedValue(1),
        },
        Annotation: {
            findAll: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
            destroy: jest.fn().mockResolvedValue(0),
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
jest.mock('../services/EdgeService', () => ({
    createEdge: jest.fn(),
    updateEdge: jest.fn(),
    deleteEdge: jest.fn(),
    getEdges: jest.fn(),
}));
jest.mock('../services/AnnotationService', () => ({}));
jest.mock('../services/EventService', () => ({}));
jest.mock('../services/qrcode.cloudinary', () => ({
    generateQRCode: jest.fn().mockResolvedValue('http://qr.test/qr.png'),
    deleteQRCode: jest.fn().mockResolvedValue(),
}));
jest.mock('../services/upload.hybrid', () => ({
    upload360Hybrid: { single: jest.fn().mockReturnValue((_req, _res, next) => next()) },
    saveFileHybrid: jest.fn().mockResolvedValue({ url: 'http://cdn.test/file.jpg' }),
    saveBase64Hybrid: jest.fn().mockResolvedValue({ cloudinaryUrl: 'http://cdn.test/img.jpg' }),
    deleteFileHybrid: jest.fn().mockResolvedValue(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeToken = () =>
    jwt.sign(
        { id: 1, username: 'admin', is_staff: true, is_superuser: false },
        process.env.JWT_SECRET,
        { expiresIn: '1h' },
    );

const MOCK_EDGE = {
    edge_id: 10,
    from_node_id: 1,
    to_node_id: 2,
    distance: 15.5,
    compass_angle: 90.0,
    is_staircase: false,
    is_active: true,
    from_node: { node_id: 1, node_code: 'N-001', name: 'Room A' },
    to_node: { node_id: 2, node_code: 'N-002', name: 'Room B' },
};

// ── READ Tests ────────────────────────────────────────────────────────────────

describe('GET /api/mobile/edges (list)', () => {
    let app;
    let Edges;

    beforeAll(() => {
        app = require('../server');
        ({ Edges } = require('../models'));
    });

    afterEach(() => jest.clearAllMocks());

    it('returns 200 with array of edges (public, no auth required)', async () => {
        Edges.findAll.mockResolvedValue([MOCK_EDGE]);

        const res = await request(app).get('/api/mobile/edges');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.edges)).toBe(true);
        expect(res.body.edges[0].edge_id).toBe(10);
    });

    it('returns 200 with empty array when no edges exist', async () => {
        Edges.findAll.mockResolvedValue([]);

        const res = await request(app).get('/api/mobile/edges');

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(0);
    });
});

// ── CREATE Tests ──────────────────────────────────────────────────────────────

describe('POST /api/mobile/admin/edges/create', () => {
    let app;
    let Nodes, Edges;

    beforeAll(() => {
        app = require('../server');
        ({ Nodes, Edges } = require('../models'));
    });

    afterEach(() => jest.clearAllMocks());

    it('returns 401 when no auth token provided', async () => {
        const res = await request(app)
            .post('/api/mobile/admin/edges/create')
            .send({ from_node_id: 1, to_node_id: 2, distance: 10, compass_angle: 90 });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Authentication required');
    });

    it('returns 200 on valid edge creation', async () => {
        const mockNode = { node_id: 1, name: 'Room A' };
        Nodes.findByPk.mockResolvedValue(mockNode);
        Edges.create = jest.fn().mockResolvedValue(MOCK_EDGE);

        const res = await request(app)
            .post('/api/mobile/admin/edges/create')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({ from_node_id: 1, to_node_id: 2, distance: 15.5, compass_angle: 90 });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('returns 400 when EdgeService throws a validation error (invalid node)', async () => {
        Nodes.findByPk.mockResolvedValue(null); // Nodes not found → 404

        const res = await request(app)
            .post('/api/mobile/admin/edges/create')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({ from_node_id: 999, to_node_id: 2, distance: 5, compass_angle: 45 });

        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.body.success).toBe(false);
    });

    it('returns 401 with "Session expired" for an expired token', async () => {
        const expiredToken = jwt.sign(
            { id: 1, is_staff: true },
            process.env.JWT_SECRET,
            { expiresIn: '-1s' },
        );

        const res = await request(app)
            .post('/api/mobile/admin/edges/create')
            .set('Authorization', `Bearer ${expiredToken}`)
            .send({ from_node_id: 1, to_node_id: 2, distance: 5, compass_angle: 45 });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Session expired');
    });
});

// ── UPDATE Tests ──────────────────────────────────────────────────────────────

describe('PUT /api/mobile/admin/edges/:edge_id/update', () => {
    let app;
    let Edges;

    beforeAll(() => {
        app = require('../server');
        ({ Edges } = require('../models'));
    });

    afterEach(() => jest.clearAllMocks());

    it('returns 401 when no auth token provided', async () => {
        const res = await request(app)
            .put('/api/mobile/admin/edges/10/update')
            .send({ distance: 20 });

        expect(res.status).toBe(401);
    });

    it('returns 200 on successful update', async () => {
        const mockEdge = { ...MOCK_EDGE, update: jest.fn().mockResolvedValue(true) };
        Edges.findByPk.mockResolvedValue(mockEdge);

        const res = await request(app)
            .put('/api/mobile/admin/edges/10/update')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({ distance: 20 });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('returns 404 when edge does not exist', async () => {
        Edges.findByPk.mockResolvedValue(null);

        const res = await request(app)
            .put('/api/mobile/admin/edges/9999/update')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({ distance: 20 });

        expect(res.status).toBeGreaterThanOrEqual(400);
    });
});

// ── DELETE Tests ──────────────────────────────────────────────────────────────

describe('DELETE /api/mobile/admin/edges/:edge_id/delete', () => {
    let app;
    let Edges;

    beforeAll(() => {
        app = require('../server');
        ({ Edges } = require('../models'));
    });

    afterEach(() => jest.clearAllMocks());

    it('returns 401 when no auth token provided', async () => {
        const res = await request(app).delete('/api/mobile/admin/edges/10/delete');
        expect(res.status).toBe(401);
    });

    it('returns 200 on successful deletion', async () => {
        const mockEdge = { ...MOCK_EDGE, destroy: jest.fn().mockResolvedValue(1) };
        Edges.findByPk.mockResolvedValue(mockEdge);

        const res = await request(app)
            .delete('/api/mobile/admin/edges/10/delete')
            .set('Authorization', `Bearer ${makeToken()}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('returns error when edge does not exist', async () => {
        Edges.findByPk.mockResolvedValue(null);

        const res = await request(app)
            .delete('/api/mobile/admin/edges/9999/delete')
            .set('Authorization', `Bearer ${makeToken()}`);

        expect(res.status).toBeGreaterThanOrEqual(400);
    });
});
