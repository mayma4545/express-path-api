/**
 * Connectivity & Rate Limiter Reproduction Test
 */

const request = require('supertest');
const app = require('../server');
const { perInstallLimiter, installIdKeyGenerator } = require('../middleware/rateLimiter');

describe('Connectivity & Rate Limiter Diagnostics', () => {
    describe('installIdKeyGenerator', () => {
        test('should use install ID from header if valid UUID v4', () => {
            const req = {
                headers: {
                    'x-app-install-id': '550e8400-e29b-41d4-a716-446655440000'
                }
            };
            expect(installIdKeyGenerator(req)).toBe('install:550e8400-e29b-41d4-a716-446655440000');
        });

        test('should fall back to IP if header is missing', () => {
            const req = {
                headers: {},
                ip: '127.0.0.1'
            };
            expect(installIdKeyGenerator(req)).toBe('ip:127.0.0.1');
        });

        test('should fall back to IP if header is invalid format', () => {
            const req = {
                headers: {
                    'x-app-install-id': 'invalid-uuid'
                },
                ip: '127.0.0.1'
            };
            expect(installIdKeyGenerator(req)).toBe('ip:127.0.0.1');
        });
    });

    describe('GET /api/mobile/ping/', () => {
        test('should return 200 and isOnline: true', async () => {
            const res = await request(app).get('/api/mobile/ping/');
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ isOnline: true });
        });
    });
});
