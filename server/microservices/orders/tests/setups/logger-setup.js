// tests/setups/logger-setup.js
// Executed before tests to minimize logging noise
process.env.NODE_ENV = 'test';
// Default to only show errors; user can override with TEST_LOG_LEVEL=warn or info if needed.
if (!process.env.TEST_LOG_LEVEL) {
    process.env.TEST_LOG_LEVEL = 'error';
}
