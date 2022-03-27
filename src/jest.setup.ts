import failOnConsole from 'jest-fail-on-console';

// Fail when console logs something inside a test - use spyOn instead
failOnConsole({
  shouldFailOnWarn: true,
  shouldFailOnError: true,
  shouldFailOnLog: true,
  shouldFailOnAssert: true,
});
