module.exports = {
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  modulePathIgnorePatterns: ['src/model/cloud-runner'],
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  testRunner: 'jest-circus/runner',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  verbose: true,
};
