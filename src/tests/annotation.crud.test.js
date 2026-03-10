/**
 * Annotation CRUD API Tests
 * Tests: create, read (list), update, delete
 * Verifies: auth enforcement, panorama node validation, 404 handling.
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
            findAll: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
            destroy: jest.fn().mockResolvedValue(0),
        },
        Annotation: {
            findAll: jest.fn(),
            findByPk: jest.fn(),
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
jest.mock('../services/EdgeService', () => ({}));
jest.mock('../services/EventService', () => ({}));
jest.mock('../services/AnnotationService', () => ({
    createAnnotation: jest.fn(),
    updateAnnotation: jest.fn(),
    deleteAnnotation: jest.fn(),
    getAnnotations: jest.fn(),
    getAnnotationById: jest.fn(),
    getPanoramas: jest.fn(),
}));
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

const MOCK_ANNOTATION = {
    id: 20,
    panorama_id: 1,
    target_node_id: 2,
    label: 'Go to Lab',
    yaw: 45.0,
    pitch: 0.0,
    visible_radius: 60.0,
    is_active: true,
    panorama: { node_id: 1, node_code: 'N-001', name: 'Lobby' },
    target_node: { node_id: 2, node_code: 'N-002', name: 'Lab 101' },
};

// ── READ Tests ────────────────────────────────────────────────────────────────

describe('GET /api/mobile/annotations (public list)', () => {
    let app;
    let Annotation;

    beforeAll(() => {
        app = require('../server');
        ({ Annotation } = require('../models'));
    });

    afterEach(() => jest.clearAllMocks());

    it('returns 200 with annotation list (no auth required)', async () => {
        Annotation.findAll.mockResolvedValue([MOCK_ANNOTATION]);

        const res = await request(app).get('/api/mobile/annotations');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.annotations)).toBe(true);
    });

    it('returns 200 filtered by panorama_id', async () => {
        Annotation.findAll.mockResolvedValue([MOCK_ANNOTATION]);

        const res = await request(app)
            .get('/api/mobile/annotations')
            .query({ panorama_id: 1 });

        expect(res.status).toBe(200);
    });

    it('returns 200 with empty array when no annotations exist', async () => {
        Annotation.findAll.mockResolvedValue([]);

        const res = await request(app).get('/api/mobile/annotations');

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(0);
    });
});

// ── CREATE Tests ──────────────────────────────────────────────────────────────

describe('POST /api/mobile/admin/annotations/create', () => {
    let app;
    let Nodes, Annotation;

    beforeAll(() => {
        app = require('../server');
        ({ Nodes, Annotation } = require('../models'));
    });

    afterEach(() => jest.clearAllMocks());

    it('returns 401 without auth', async () => {
        const res = await request(app)
            .post('/api/mobile/admin/annotations/create')
            .send({ panorama_id: 1, label: 'Exit', yaw: 180, pitch: 0 });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Authentication required');
    });

    it('returns 200 on valid annotation creation', async () => {
        const mockPanorama = { node_id: 1, name: 'Panorama Room' };
        Nodes.findByPk.mockResolvedValue(mockPanorama);
        Annotation.create = jest.fn().mockResolvedValue(MOCK_ANNOTATION);

        const res = await request(app)
            .post('/api/mobile/admin/annotations/create')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({ panorama_id: 1, label: 'Go to Lab', yaw: 45, pitch: 0, visible_radius: 60 });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('returns error when panorama node does not exist', async () => {
        Nodes.findByPk.mockResolvedValue(null); // panorama not found → 404

        const res = await request(app)
            .post('/api/mobile/admin/annotations/create')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({ panorama_id: 999, label: 'Test', yaw: 0, pitch: 0 });

        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.body.success).toBe(false);
    });

    it('returns 401 with "Session expired" for expired token', async () => {
        const expiredToken = jwt.sign(
            { id: 1, is_staff: true },
            process.env.JWT_SECRET,
            { expiresIn: '-1s' },
        );

        const res = await request(app)
            .post('/api/mobile/admin/annotations/create')
            .set('Authorization', `Bearer ${expiredToken}`)
            .send({ panorama_id: 1, label: 'Test', yaw: 0, pitch: 0 });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Session expired');
    });
});

// ── UPDATE Tests ──────────────────────────────────────────────────────────────

describe('PUT /api/mobile/admin/annotations/:annotation_id/update', () => {
    let app;
    let Annotation;

    beforeAll(() => {
        app = require('../server');
        ({ Annotation } = require('../models'));
    });

    afterEach(() => jest.clearAllMocks());

    it('returns 401 without auth', async () => {
        const res = await request(app)
            .put('/api/mobile/admin/annotations/20/update')
            .send({ label: 'Updated Label' });

        expect(res.status).toBe(401);
    });

    it('returns 200 on successful update', async () => {
        const mockAnnotation = { ...MOCK_ANNOTATION, update: jest.fn().mockResolvedValue(true) };
        Annotation.findByPk.mockResolvedValue(mockAnnotation);

        const res = await request(app)
            .put('/api/mobile/admin/annotations/20/update')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({ label: 'Updated Label' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('returns error when annotation does not exist', async () => {
        Annotation.findByPk.mockResolvedValue(null);

        const res = await request(app)
            .put('/api/mobile/admin/annotations/9999/update')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({ label: 'Ghost' });

        expect(res.status).toBeGreaterThanOrEqual(400);
    });
});

// ── DELETE Tests ──────────────────────────────────────────────────────────────

describe('DELETE /api/mobile/admin/annotations/:annotation_id/delete', () => {
    let app;
    let Annotation;

    beforeAll(() => {
        app = require('../server');
        ({ Annotation } = require('../models'));
    });

    afterEach(() => jest.clearAllMocks());

    it('returns 401 without auth', async () => {
        const res = await request(app).delete('/api/mobile/admin/annotations/20/delete');
        expect(res.status).toBe(401);
    });

    it('returns 200 on successful deletion', async () => {
        const mockAnnotation = { ...MOCK_ANNOTATION, destroy: jest.fn().mockResolvedValue(1) };
        Annotation.findByPk.mockResolvedValue(mockAnnotation);

        const res = await request(app)
            .delete('/api/mobile/admin/annotations/20/delete')
            .set('Authorization', `Bearer ${makeToken()}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('returns error when annotation does not exist', async () => {
        Annotation.findByPk.mockResolvedValue(null);

        const res = await request(app)
            .delete('/api/mobile/admin/annotations/9999/delete')
            .set('Authorization', `Bearer ${makeToken()}`);

        expect(res.status).toBeGreaterThanOrEqual(400);
    });
});
