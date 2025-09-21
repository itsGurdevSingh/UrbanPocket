// jest.config.js
module.exports = {
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: [
    './tests/setup.js',
    './tests/redis-setup.js'
  ],
  testEnvironment: 'node',
};