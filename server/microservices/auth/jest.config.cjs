// jest.config.js
module.exports = {
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['./tests/setup.js'],
  testEnvironment: 'node',
};