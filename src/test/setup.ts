import { afterEach, beforeEach } from 'vitest';

// Fail tests when console.error / console.warn etc are called from
// production code under test. Mirrors the jest-fail-on-console behaviour
// the previous jest setup enforced. Tests can opt-out by replacing the
// method with vi.spyOn(console, 'error') for the duration of that test.
const original = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  assert: console.assert,
};

const fail = (level: 'log' | 'warn' | 'error' | 'assert', args: unknown[]) => {
  throw new Error(
    `console.${level} was called with: ${args.map(String).join(' ')}\n` +
      `Tests must use vi.spyOn(console, '${level}') if console output is expected.`,
  );
};

beforeEach(() => {
  console.log = (...args: unknown[]) => fail('log', args);
  console.warn = (...args: unknown[]) => fail('warn', args);
  console.error = (...args: unknown[]) => fail('error', args);
  console.assert = ((...args: unknown[]) => fail('assert', args)) as typeof console.assert;
});

afterEach(() => {
  Object.assign(console, original);
});
