import failOnConsole from 'jest-fail-on-console';

// Polyfill fetch for the Node.js test environment.
// Jest runs tests inside a VM context where the global `fetch` is not
// automatically provided, even on Node 18+. Octokit requires a `fetch`
// implementation, so we provide one using undici's implementation.
// This ensures tests that interact with Octokit do not throw when
// constructing the client.
import { fetch, Headers, Request, Response } from 'undici';

if (!global.fetch) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).fetch = fetch;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).Headers = Headers;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).Request = Request;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).Response = Response;
}

// Fail when console logs something inside a test - use spyOn instead
failOnConsole({
  shouldFailOnWarn: true,
  shouldFailOnError: true,
  shouldFailOnLog: true,
  shouldFailOnAssert: true,
});
