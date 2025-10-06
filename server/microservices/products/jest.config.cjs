// jest.config.js
module.exports = {
    testMatch: ['**/tests/**/*.test.js'],
    setupFilesAfterEnv: [
        './tests/setups/setup.js',
        './tests/setups/redis-setup.js',
        './tests/setups/imagekit-setup.js'
    ],
    testEnvironment: 'node',
};