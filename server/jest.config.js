module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/cleanup.js'],
  testTimeout: 15000,
  maxWorkers: 1,
};
