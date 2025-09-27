// jest.config.js
module.exports = {
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: [
    './tests/setups/setup.js',
    './tests/setups/redis-setup.js'
  ],
  testEnvironment: 'node',
};