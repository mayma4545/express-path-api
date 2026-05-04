/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/src/tests/**/*.test.js'],
    // api.test.js is a standalone HTTP integration runner, not a Jest suite
    testPathIgnorePatterns: ['/node_modules/', '/src/tests/api.test.js'],
    setupFiles: ['<rootDir>/src/tests/setup.js'],
    // Each test file gets a fresh module registry; prevents cross-test state leakage
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 15000,
    // Suppress noisy console output from server startup during tests
    silent: false,
    verbose: true,
};
