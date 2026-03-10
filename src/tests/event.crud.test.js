/**
 * Event CRUD API Tests
 * Tests: create, read (list + admin-all), update, delete
 * Verifies: auth enforcement, date validation, 404 handling.
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
            findAll: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
            destroy: jest.fn().mockResolvedValue(0),
        },
        CampusMap: { findOne: jest.fn().mockResolvedValue(null) },
        Event: {
            findAll: jest.fn(),
            findByPk: jest.fn(),
            count: jest.fn().mockResolvedValue(3),
        },
    };
});

jest.mock('../services/pathfinding', () => ({
    getPathfinder: jest.fn(),
    resetPathfinder: jest.fn(),
}));
jest.mock('../services/NodeService', () => ({}));
jest.mock('../services/EdgeService', () => ({}));
jest.mock('../services/AnnotationService', () => ({}));
jest.mock('../services/EventService', () => ({
    getActiveEvents: jest.fn(),
    getAllEvents: jest.fn(),
    getEventById: jest.fn(),
    createEvent: jest.fn(),
    updateEvent: jest.fn(),
    deleteEvent: jest.fn(),
    combinedSearch: jest.fn(),
    getStats: jest.fn(),
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

const MOCK_EVENT = {
    event_id: 5,
    event_name: 'Career Fair 2026',
    description: 'Annual career fair',
    category: 'Career',
    node_id: 1,
    start_datetime: '2026-04-01T09:00:00',
    end_datetime: '2026-04-01T17:00:00',
    is_active: true,
    is_featured: false,
};

// ── READ Tests ────────────────────────────────────────────────────────────────

describe('GET /api/mobile/events (public active events)', () => {
    let app;
    let EventService;

    beforeAll(() => {
        app = require('../server');
        EventService = require('../services/EventService');
    });

    afterEach(() => jest.clearAllMocks());

    it('returns 200 with array of active events', async () => {
        EventService.getActiveEvents.mockResolvedValue([MOCK_EVENT]);

        const res = await request(app).get('/api/mobile/events');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.events)).toBe(true);
    });

    it('returns 200 with empty array when no active events', async () => {
        EventService.getActiveEvents.mockResolvedValue([]);

        const res = await request(app).get('/api/mobile/events');

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(0);
    });

    it('accepts search and category query params', async () => {
        EventService.getActiveEvents.mockResolvedValue([]);

        const res = await request(app)
            .get('/api/mobile/events')
            .query({ search: 'career', category: 'Career' });

        expect(res.status).toBe(200);
        expect(EventService.getActiveEvents).toHaveBeenCalledWith(
            expect.objectContaining({ search: 'career', category: 'Career' }),
        );
    });
});

describe('GET /api/mobile/admin/events/all (admin all events)', () => {
    let app;
    let EventService;

    beforeAll(() => {
        app = require('../server');
        EventService = require('../services/EventService');
    });

    afterEach(() => jest.clearAllMocks());

    it('returns 401 without auth token', async () => {
        const res = await request(app).get('/api/mobile/admin/events/all');
        expect(res.status).toBe(401);
    });

    it('returns 200 with all events for authenticated admin', async () => {
        EventService.getAllEvents.mockResolvedValue([MOCK_EVENT]);

        const res = await request(app)
            .get('/api/mobile/admin/events/all')
            .set('Authorization', `Bearer ${makeToken()}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

// ── CREATE Tests ──────────────────────────────────────────────────────────────

describe('POST /api/mobile/admin/events/create', () => {
    let app;
    let EventService;

    beforeAll(() => {
        app = require('../server');
        EventService = require('../services/EventService');
    });

    afterEach(() => jest.clearAllMocks());

    it('returns 401 without auth', async () => {
        const res = await request(app)
            .post('/api/mobile/admin/events/create')
            .send({ event_name: 'Test Event' });

        expect(res.status).toBe(401);
    });

    it('returns 200 on valid event creation', async () => {
        EventService.createEvent.mockResolvedValue(MOCK_EVENT);

        const res = await request(app)
            .post('/api/mobile/admin/events/create')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({
                event_name: 'Career Fair 2026',
                category: 'Career',
                node_id: 1,
                start_datetime: '2026-04-01T09:00:00',
                end_datetime: '2026-04-01T17:00:00',
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(EventService.createEvent).toHaveBeenCalledTimes(1);
    });

    it('returns error when EventService throws (e.g. end_datetime before start_datetime)', async () => {
        EventService.createEvent.mockRejectedValue(
            new Error('end_datetime must be after start_datetime'),
        );

        const res = await request(app)
            .post('/api/mobile/admin/events/create')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({
                event_name: 'Bad Event',
                start_datetime: '2026-04-02T09:00:00',
                end_datetime: '2026-04-01T09:00:00', // end before start
            });

        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.body.success).toBe(false);
    });
});

// ── UPDATE Tests ──────────────────────────────────────────────────────────────

describe('PUT /api/mobile/admin/events/:event_id/update', () => {
    let app;
    let EventService;

    beforeAll(() => {
        app = require('../server');
        EventService = require('../services/EventService');
    });

    afterEach(() => jest.clearAllMocks());

    it('returns 401 without auth', async () => {
        const res = await request(app)
            .put('/api/mobile/admin/events/5/update')
            .send({ event_name: 'Updated' });

        expect(res.status).toBe(401);
    });

    it('returns 200 on successful update', async () => {
        EventService.updateEvent.mockResolvedValue({ ...MOCK_EVENT, event_name: 'Updated Fair' });

        const res = await request(app)
            .put('/api/mobile/admin/events/5/update')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({ event_name: 'Updated Fair' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('returns error when EventService throws for missing event', async () => {
        EventService.updateEvent.mockRejectedValue(new Error('Event not found'));

        const res = await request(app)
            .put('/api/mobile/admin/events/9999/update')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({ event_name: 'Ghost Event' });

        expect(res.status).toBeGreaterThanOrEqual(400);
    });
});

// ── DELETE Tests ──────────────────────────────────────────────────────────────

describe('DELETE /api/mobile/admin/events/:event_id/delete', () => {
    let app;
    let EventService;

    beforeAll(() => {
        app = require('../server');
        EventService = require('../services/EventService');
    });

    afterEach(() => jest.clearAllMocks());

    it('returns 401 without auth', async () => {
        const res = await request(app).delete('/api/mobile/admin/events/5/delete');
        expect(res.status).toBe(401);
    });

    it('returns 200 on successful deletion', async () => {
        EventService.deleteEvent.mockResolvedValue({ deleted: true });

        const res = await request(app)
            .delete('/api/mobile/admin/events/5/delete')
            .set('Authorization', `Bearer ${makeToken()}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('returns error when event does not exist', async () => {
        EventService.deleteEvent.mockRejectedValue(new Error('Event not found'));

        const res = await request(app)
            .delete('/api/mobile/admin/events/9999/delete')
            .set('Authorization', `Bearer ${makeToken()}`);

        expect(res.status).toBeGreaterThanOrEqual(400);
    });
});
