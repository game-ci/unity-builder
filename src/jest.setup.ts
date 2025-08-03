import failOnConsole from 'jest-fail-on-console';

// Polyfill fetch for the Node.js test environment.
// Jest runs tests inside a VM context where the global `fetch` is not
// automatically provided, even on Node 18+. Octokit requires a `fetch`
// implementation, so we provide one using undici's implementation.
// This ensures tests that interact with Octokit do not throw when
// constructing the client.
import { fetch as undiciFetch, Headers, Request, Response } from 'undici';

Object.assign(globalThis, { fetch: undiciFetch, Headers, Request, Response });

// Fail when console logs something inside a test - use spyOn instead
failOnConsole({
  shouldFailOnWarn: true,
  shouldFailOnError: true,
  shouldFailOnLog: true,
  shouldFailOnAssert: true,
});
