/**
 * Jest global setup for backend tests.
 * Runs before each test file is loaded.
 * Sets environment variables so server.js doesn't fatal-exit on missing secrets.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests-only-32chars!!';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.PORT = '0'; // Let OS assign a free port during tests
