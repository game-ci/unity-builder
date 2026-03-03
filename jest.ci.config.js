const base = require('./jest.config.js');

module.exports = {
  ...base,
  forceExit: true,
  detectOpenHandles: true,
  testTimeout: 120000,
  maxWorkers: 1,
};


