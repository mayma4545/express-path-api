/**
 * Comprehensive API Test Suite
 * Tests all API endpoints for the Campus Navigation System
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Test results storage
const results = {
    passed: 0,
    failed: 0,
    tests: []
};

// Helper to make HTTP requests
function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: JSON.parse(data)
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        data: data
                    });
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

// Test helper functions
function test(name, fn) {
    return { name, fn };
}

async function runTest(testObj) {
    try {
        await testObj.fn();
        results.passed++;
        results.tests.push({ name: testObj.name, status: 'PASSED' });
        console.log(`  ✅ ${testObj.name}`);
    } catch (error) {
        results.failed++;
        results.tests.push({ name: testObj.name, status: 'FAILED', error: error.message });
        console.log(`  ❌ ${testObj.name}`);
        console.log(`     Error: ${error.message}`);
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }
}

// ============= Test Definitions =============

const healthTests = [
    test('GET / returns 200', async () => {
        const res = await request('GET', '/');
        assertEqual(res.status, 200, 'Status code');
    }),
];

const mobileApiTests = [
    test('GET /api/mobile/nodes returns nodes list', async () => {
        const res = await request('GET', '/api/mobile/nodes');
        assertEqual(res.status, 200, 'Status code');
        assert(res.data.success === true, 'Success should be true');
        assert(Array.isArray(res.data.nodes), 'Nodes should be an array');
    }),

    test('GET /api/mobile/buildings returns buildings list', async () => {
        const res = await request('GET', '/api/mobile/buildings');
        assertEqual(res.status, 200, 'Status code');
        assert(res.data.success === true, 'Success should be true');
        assert(Array.isArray(res.data.buildings), 'Buildings should be an array');
    }),

    test('GET /api/mobile/edges returns edges list', async () => {
        const res = await request('GET', '/api/mobile/edges');
        assertEqual(res.status, 200, 'Status code');
        assert(res.data.success === true, 'Success should be true');
        assert(Array.isArray(res.data.edges), 'Edges should be an array');
    }),

    test('GET /api/mobile/annotations returns annotations list', async () => {
        const res = await request('GET', '/api/mobile/annotations');
        assertEqual(res.status, 200, 'Status code');
        assert(res.data.success === true, 'Success should be true');
        assert(Array.isArray(res.data.annotations), 'Annotations should be an array');
    }),

    test('GET /api/mobile/campus-map returns campus map', async () => {
        const res = await request('GET', '/api/mobile/campus-map');
        // May return 404 if no map is configured
        assert([200, 404].includes(res.status), 'Status should be 200 or 404');
        if (res.status === 200) {
            assert(res.data.success === true, 'Success should be true');
            assert(res.data.map !== undefined, 'Map should exist');
        }
    }),

    test('GET /api/mobile/data-version returns version info', async () => {
        const res = await request('GET', '/api/mobile/data-version');
        assertEqual(res.status, 200, 'Status code');
        assert(res.data.success === true, 'Success should be true');
        assert(res.data.version !== undefined, 'Version should exist');
    }),
];

const pathfindingTests = [
    test('POST /api/mobile/find-path without params returns 400', async () => {
        const res = await request('POST', '/api/mobile/find-path', {});
        assertEqual(res.status, 400, 'Status code');
    }),

    test('POST /api/mobile/find-path with invalid nodes returns 404', async () => {
        const res = await request('POST', '/api/mobile/find-path', {
            start_code: 'INVALID_NODE',
            goal_code: 'ALSO_INVALID'
        });
        assertEqual(res.status, 404, 'Status code');
        assert(res.data.success === false, 'Success should be false');
    }),
];

const validationTests = [
    test('POST /api/mobile/admin/login without credentials returns 400', async () => {
        const res = await request('POST', '/api/mobile/admin/login', {});
        assertEqual(res.status, 400, 'Status code');
    }),

    test('POST /api/mobile/admin/login with wrong password returns 401', async () => {
        const res = await request('POST', '/api/mobile/admin/login', {
            username: 'admin',
            password: 'wrongpassword'
        });
        assertEqual(res.status, 401, 'Status code');
    }),
];

const authTests = [
    test('POST /api/mobile/admin/nodes/create without auth returns 401', async () => {
        const res = await request('POST', '/api/mobile/admin/nodes/create', {});
        assertEqual(res.status, 401, 'Status code');
    }),

    test('PUT /api/mobile/admin/nodes/1/update without auth returns 401', async () => {
        const res = await request('PUT', '/api/mobile/admin/nodes/1/update', {});
        assertEqual(res.status, 401, 'Status code');
    }),

    test('DELETE /api/mobile/admin/nodes/1/delete without auth returns 401', async () => {
        const res = await request('DELETE', '/api/mobile/admin/nodes/1/delete');
        assertEqual(res.status, 401, 'Status code');
    }),

    test('POST /api/mobile/admin/edges/create without auth returns 401', async () => {
        const res = await request('POST', '/api/mobile/admin/edges/create', {});
        assertEqual(res.status, 401, 'Status code');
    }),

    test('POST /api/mobile/admin/annotations/create without auth returns 401', async () => {
        const res = await request('POST', '/api/mobile/admin/annotations/create', {});
        assertEqual(res.status, 401, 'Status code');
    }),
];

// ============= Run All Tests =============

async function runAllTests() {
    console.log('\n🧪 Campus Navigator API Test Suite\n');
    console.log('='.repeat(50));

    console.log('\n📋 Health Check Tests:');
    for (const t of healthTests) await runTest(t);

    console.log('\n📱 Mobile API Tests:');
    for (const t of mobileApiTests) await runTest(t);

    console.log('\n🗺️  Pathfinding Tests:');
    for (const t of pathfindingTests) await runTest(t);

    console.log('\n✅ Validation Tests:');
    for (const t of validationTests) await runTest(t);

    console.log('\n🔐 Authentication Tests:');
    for (const t of authTests) await runTest(t);

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('\n📊 Test Results Summary:');
    console.log(`   Total:  ${results.passed + results.failed}`);
    console.log(`   Passed: ${results.passed} ✅`);
    console.log(`   Failed: ${results.failed} ❌`);

    if (results.failed === 0) {
        console.log('\n🎉 All tests passed!\n');
    } else {
        console.log('\n⚠️  Some tests failed. Review the output above.\n');
    }

    process.exit(results.failed > 0 ? 1 : 0);
}

// Wait for server to be ready, then run tests
console.log('⏳ Waiting for server to be ready...');
setTimeout(runAllTests, 2000);
