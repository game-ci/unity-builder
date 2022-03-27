module.exports = {
  // Automatically clear mock calls and instances between every test
  clearMocks: true,

  // An array of file extensions your modules use
  moduleFileExtensions: ['js', 'ts'],

  // The test environment that will be used for testing
  testEnvironment: 'node',

  // The glob patterns Jest uses to detect test files
  testMatch: ['**/*.test.ts'],

  // This option allows use of a custom test runner
  testRunner: 'jest-circus/runner',

  // A map with regular expressions for transformers to paths
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },

  // Indicates whether each individual test should be reported during the run
  verbose: true,

  // An array of regexp pattern strings, matched against all module paths before considered 'visible' to the module loader
  modulePathIgnorePatterns: ['<rootDir>/lib/', '<rootDir>/dist/'],

  // A list of paths to modules that run some code to configure or set up the testing framework before each test
  setupFilesAfterEnv: ['<rootDir>/src/jest.setup.ts'],
};
