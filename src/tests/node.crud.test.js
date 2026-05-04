/**
 * Node CRUD API Tests
 * Tests: create, read (list + single), update, delete
 * Verifies: auth enforcement, 404 handling, validation errors, cascade side-effects.
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
            findAll: jest.fn(),
            findByPk: jest.fn(),
            count: jest.fn().mockResolvedValue(5),
        },
        Edges: {
            findAll: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
            destroy: jest.fn().mockResolvedValue(2),
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

jest.mock('../services/NodeService', () => ({
    createNode: jest.fn(),
    updateNode: jest.fn(),
    deleteNode: jest.fn(),
    getNodes: jest.fn(),
    getNodeById: jest.fn(),
    getBuildings: jest.fn(),
    getStats: jest.fn(),
}));

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

const MOCK_NODE = {
    node_id: 1,
    node_code: 'TEST-001',
    name: 'Test Room',
    building: 'Main Building',
    floor_level: 1,
    type_of_node: 'room',
    map_x: 50.0,
    map_y: 50.0,
    image360: null,
    qrcode: null,
    description: 'A test room',
    update: jest.fn().mockResolvedValue(true),
    destroy: jest.fn().mockResolvedValue(true),
};

// ── READ Tests ────────────────────────────────────────────────────────────────

describe('GET /api/mobile/nodes (list)', () => {
    let app;
    let Nodes;

    beforeAll(() => {
        app = require('../server');
        ({ Nodes } = require('../models'));
    });

    afterEach(() => jest.clearAllMocks());

    it('returns 200 with an array of nodes', async () => {
        Nodes.findAll.mockResolvedValue([MOCK_NODE]);

        const res = await request(app).get('/api/mobile/nodes');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.nodes)).toBe(true);
        expect(res.body.nodes[0].node_code).toBe('TEST-001');
    });

    it('returns 200 with empty array when no nodes exist', async () => {
        Nodes.findAll.mockResolvedValue([]);

        const res = await request(app).get('/api/mobile/nodes');

        expect(res.status).toBe(200);
        expect(res.body.nodes).toHaveLength(0);
        expect(res.body.count).toBe(0);
    });

    it('accepts search, building, and floor query params without error', async () => {
        Nodes.findAll.mockResolvedValue([MOCK_NODE]);

        const res = await request(app)
            .get('/api/mobile/nodes')
            .query({ search: 'Test', building: 'Main Building', floor: '1' });

        expect(res.status).toBe(200);
    });
});

describe('GET /api/mobile/nodes/:node_id (detail)', () => {
    let app;
    let Nodes, Annotation;

    beforeAll(() => {
        app = require('../server');
        ({ Nodes, Annotation } = require('../models'));
    });

    afterEach(() => jest.clearAllMocks());

    it('returns 200 with node detail and annotations', async () => {
        Nodes.findByPk.mockResolvedValue(MOCK_NODE);
        Annotation.findAll.mockResolvedValue([]);

        const res = await request(app).get('/api/mobile/nodes/1');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.node.node_id).toBe(1);
        expect(Array.isArray(res.body.node.annotations)).toBe(true);
    });

    it('returns 404 when node does not exist', async () => {
        Nodes.findByPk.mockResolvedValue(null);

        const res = await request(app).get('/api/mobile/nodes/9999');

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
    });
});

// ── CREATE Tests ──────────────────────────────────────────────────────────────

describe('POST /api/mobile/admin/nodes/create', () => {
    let app;
    let NodeService;

    beforeAll(() => {
        app = require('../server');
        NodeService = require('../services/NodeService');
    });

    afterEach(() => jest.clearAllMocks());

    it('returns 401 when no auth token is provided', async () => {
        const res = await request(app)
            .post('/api/mobile/admin/nodes/create')
            .send({ name: 'Room 101' });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Authentication required');
    });

    it('returns 401 with "Session expired" for an expired token', async () => {
        const expiredToken = jwt.sign(
            { id: 1, username: 'admin', is_staff: true },
            process.env.JWT_SECRET,
            { expiresIn: '-1s' },
        );

        const res = await request(app)
            .post('/api/mobile/admin/nodes/create')
            .set('Authorization', `Bearer ${expiredToken}`)
            .send({ name: 'Room 101' });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Session expired');
    });

    it('returns 200 and the new node_id on valid creation', async () => {
        NodeService.createNode.mockResolvedValue({ node_id: 42, node_code: 'MAIN-R1-A1B2' });

        const res = await request(app)
            .post('/api/mobile/admin/nodes/create')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({
                name: 'Computer Lab 1',
                building: 'Main Building',
                floor_level: 1,
                type_of_node: 'room',
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.node_id).toBe(42);
        expect(NodeService.createNode).toHaveBeenCalledTimes(1);
    });

    it('returns 400 on SequelizeValidationError (missing required field)', async () => {
        const err = new Error('Missing field: name');
        err.name = 'SequelizeValidationError';
        err.errors = [{ path: 'name' }];
        NodeService.createNode.mockRejectedValue(err);

        const res = await request(app)
            .post('/api/mobile/admin/nodes/create')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({ building: 'Main', floor_level: 1 });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('returns 500 on unexpected service error', async () => {
        NodeService.createNode.mockRejectedValue(new Error('Unexpected DB failure'));

        const res = await request(app)
            .post('/api/mobile/admin/nodes/create')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({ name: 'Room', building: 'B', floor_level: 1 });

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
    });
});

// ── UPDATE Tests ──────────────────────────────────────────────────────────────

describe('PUT /api/mobile/admin/nodes/:node_id/update', () => {
    let app;
    let Nodes;

    beforeAll(() => {
        app = require('../server');
        ({ Nodes } = require('../models'));
    });

    afterEach(() => jest.clearAllMocks());

    it('returns 401 when no auth token provided', async () => {
        const res = await request(app)
            .put('/api/mobile/admin/nodes/1/update')
            .send({ name: 'Updated Name' });

        expect(res.status).toBe(401);
    });

    it('returns 404 when node does not exist', async () => {
        Nodes.findByPk.mockResolvedValue(null);

        const res = await request(app)
            .put('/api/mobile/admin/nodes/9999/update')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({ name: 'Updated' });

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe('Node not found');
    });

    it('returns 200 on successful update', async () => {
        const nodeInstance = { ...MOCK_NODE };
        nodeInstance.update = jest.fn().mockResolvedValue(true);
        Nodes.findByPk.mockResolvedValue(nodeInstance);

        const res = await request(app)
            .put('/api/mobile/admin/nodes/1/update')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({ name: 'Updated Room Name' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(nodeInstance.update).toHaveBeenCalledTimes(1);
    });

    it('passes updated image URL to node.update when base64 image is provided', async () => {
        const nodeInstance = { ...MOCK_NODE };
        nodeInstance.update = jest.fn().mockResolvedValue(true);
        Nodes.findByPk.mockResolvedValue(nodeInstance);

        const { saveBase64Hybrid, deleteFileHybrid } = require('../services/upload.hybrid');
        saveBase64Hybrid.mockResolvedValue({ cloudinaryUrl: 'http://cdn.test/new-img.jpg' });

        const res = await request(app)
            .put('/api/mobile/admin/nodes/1/update')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({ name: 'Room', image360_base64: 'data:image/jpeg;base64,/9j/abc' });

        expect(res.status).toBe(200);
        const updateCall = nodeInstance.update.mock.calls[0][0];
        expect(updateCall.image360).toBe('http://cdn.test/new-img.jpg');
    });
});

// ── DELETE Tests ──────────────────────────────────────────────────────────────

describe('DELETE /api/mobile/admin/nodes/:node_id/delete', () => {
    let app;
    let Nodes, Edges, Annotation;

    beforeAll(() => {
        app = require('../server');
        ({ Nodes, Edges, Annotation } = require('../models'));
    });

    afterEach(() => jest.clearAllMocks());

    it('returns 401 when no auth token is provided', async () => {
        const res = await request(app).delete('/api/mobile/admin/nodes/1/delete');
        expect(res.status).toBe(401);
    });

    it('returns 404 when node does not exist', async () => {
        Nodes.findByPk.mockResolvedValue(null);

        const res = await request(app)
            .delete('/api/mobile/admin/nodes/9999/delete')
            .set('Authorization', `Bearer ${makeToken()}`);

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
    });

    it('returns 200 and cascades deletion of edges and annotations', async () => {
        const nodeInstance = { ...MOCK_NODE };
        nodeInstance.destroy = jest.fn().mockResolvedValue(true);
        Nodes.findByPk.mockResolvedValue(nodeInstance);
        Edges.destroy.mockResolvedValue(2);
        Annotation.destroy.mockResolvedValue(1);

        const res = await request(app)
            .delete('/api/mobile/admin/nodes/1/delete')
            .set('Authorization', `Bearer ${makeToken()}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        // Verify cascade: edges for this node were deleted
        expect(Edges.destroy).toHaveBeenCalledTimes(1);
        // Verify cascade: annotations for this node were deleted
        expect(Annotation.destroy).toHaveBeenCalledTimes(1);
        // Verify the node itself was deleted
        expect(nodeInstance.destroy).toHaveBeenCalledTimes(1);
    });
});
