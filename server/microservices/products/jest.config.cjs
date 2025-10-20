// jest.config.js
module.exports = {
    testMatch: ['**/tests/**/*.test.js'],
    setupFilesAfterEnv: [
        './tests/setups/logger-setup.js',
        './tests/setups/setup.js',
        './tests/setups/redis-setup.js',
        './tests/setups/imagekit-setup.js',
        './tests/setups/auth-setup.js'
    ],
    testEnvironment: 'node',
};