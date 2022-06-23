// Source: https://github.com/devlato/async-wait-until/blob/master/src/index.ts

/**
 * This module implements a function that waits for a given predicate to be truthy.
 * Relies on Promises and supports async/await.
 * @packageDocumentation
 * @module async-wait-until
 */

/**
 * @type Error JavaScript's generic Error type
 * @public
 */

/**
 * Timeout error, which is thrown when timeout passes but the predicate
 * doesn't resolve with a truthy value
 * @public
 * @class
 * @exception
 * @category Exceptions
 */
export class TimeoutError extends Error {
  /**
   * Creates a TimeoutError instance
   * @public
   * @param timeoutInMs Expected timeout, in milliseconds
   */
  constructor(timeoutInMs?: number) {
    super(timeoutInMs != null ? `Timed out after waiting for ${timeoutInMs} ms` : 'Timed out');

    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * A utility function for cross-platform type-safe scheduling
 * @private
 * @returns Returns a proper scheduler instance depending on the current environment
 * @throws Error
 * @category Utilities
 */
const getScheduler = (): Scheduler => ({
  schedule: (fn, interval) => {
    let scheduledTimer: number | NodeJS.Timeout | undefined = undefined;

    const cleanUp = (timer: number | NodeJS.Timeout | undefined) => {
      if (timer != null) {
        clearTimeout(timer as number);
      }

      scheduledTimer = undefined;
    };

    const iteration = () => {
      cleanUp(scheduledTimer);
      fn();
    };

    scheduledTimer = setTimeout(iteration, interval);

    return {
      cancel: () => cleanUp(scheduledTimer),
    };
  },
});

/**
 * Delays the execution by the given interval, in milliseconds
 * @private
 * @param scheduler A scheduler instance
 * @param interval An interval to wait for before resolving the Promise, in milliseconds
 * @returns A Promise that gets resolved once the given interval passes
 * @throws Error
 * @category Utilities
 */
const delay = (scheduler: Scheduler, interval: number): Promise<void> =>
  new Promise((resolve, reject) => {
    try {
      scheduler.schedule(resolve, interval);
    } catch (e) {
      reject(e);
    }
  });

/**
 * Platform-specific scheduler
 * @private
 * @category Defaults
 */
const SCHEDULER: Scheduler = getScheduler();

/**
 * Default interval between attempts, in milliseconds
 * @public
 * @category Defaults
 */
export const DEFAULT_INTERVAL_BETWEEN_ATTEMPTS_IN_MS = 50;

/**
 * Default timeout, in milliseconds
 * @public
 * @category Defaults
 */
export const DEFAULT_TIMEOUT_IN_MS = 5000;

/**
 * Timeout that represents infinite wait time
 * @public
 * @category Defaults
 */
export const WAIT_FOREVER = Number.POSITIVE_INFINITY;

/**
 * Waits for predicate to be truthy and resolves a Promise
 * @public
 * @param predicate A predicate function that checks the condition, it should return either a truthy value or a falsy value
 * @param options Options object (or *(deprecated)*: a maximum wait interval, *5000 ms* by default)
 * @param intervalBetweenAttempts *(deprecated)* Interval to wait for between attempts, optional, *50 ms* by default
 * @returns A promise to return the given predicate's result, once it resolves with a truthy value
 * @template T Result type for the truthy value returned by the predicate
 * @throws [[TimeoutError]] An exception thrown when the specified timeout interval passes but the predicate doesn't return a truthy value
 * @throws Error
 * @see [[TruthyValue]]
 * @see [[FalsyValue]]
 * @see [[Options]]
 */
export const waitUntil = <T extends PredicateReturnValue>(
  predicate: Predicate<T>,
  options?: number | Options,
  intervalBetweenAttempts?: number,
): Promise<T> => {
  const timerTimeout = (typeof options === 'number' ? options : options?.timeout) ?? DEFAULT_TIMEOUT_IN_MS;
  const timerIntervalBetweenAttempts =
    (typeof options === 'number' ? intervalBetweenAttempts : options?.intervalBetweenAttempts) ??
    DEFAULT_INTERVAL_BETWEEN_ATTEMPTS_IN_MS;

  const runPredicate = (): Promise<ReturnType<Predicate<T>>> =>
    new Promise((resolve, reject) => {
      try {
        resolve(predicate());
      } catch (e) {
        reject(e);
      }
    });

  let isTimedOut = false;

  const predicatePromise = (): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const iteration = () => {
        if (isTimedOut) {
          return;
        }

        runPredicate()
          .then((result) => {
            if (result) {
              resolve(result);
              return;
            }

            delay(SCHEDULER, timerIntervalBetweenAttempts).then(iteration).catch(reject);
          })
          .catch(reject);
      };

      iteration();
    });

  const timeoutPromise =
    timerTimeout !== WAIT_FOREVER
      ? () =>
          delay(SCHEDULER, timerTimeout).then(() => {
            isTimedOut = true;
            throw new TimeoutError(timerTimeout);
          })
      : undefined;

  return timeoutPromise != null ? Promise.race([predicatePromise(), timeoutPromise()]) : predicatePromise();
};

/**
 * The predicate type
 * @private
 * @template T Returned value type, either a truthy value or a falsy value
 * @throws Error
 * @category Common Types
 * @see [[TruthyValue]]
 * @see [[FalsyValue]]
 */
export type Predicate<T extends PredicateReturnValue> = () => T | Promise<T>;

/**
 * A type that represents a falsy value
 * @private
 * @category Common Types
 */
export type FalsyValue = null | undefined | false | '' | 0 | void;

/**
 * A type that represents a truthy value
 * @private
 * @category Common Types
 */
export type TruthyValue =
  | Record<string, unknown>
  | unknown[]
  | symbol
  // eslint-disable-next-line no-unused-vars
  | ((...args: unknown[]) => unknown)
  | Exclude<number, 0>
  | Exclude<string, ''>
  | true;

/**
 * A type that represents a Predicate's return value
 * @private
 * @category Common Types
 */
export type PredicateReturnValue = TruthyValue | FalsyValue;

/**
 * Options that allow to specify timeout or time interval between consecutive attempts
 * @public
 * @category Common Types
 */
export type Options = {
  /**
   * @property Maximum wait interval, *5000 ms* by default
   */
  timeout?: number;

  /**
   * @property Interval to wait for between attempts, optional, *50 ms* by default
   */
  intervalBetweenAttempts?: number;
};

/**
 * A function that schedules a given callback to run in given number of milliseconds
 * @private
 * @param callback A callback to execute
 * @param interval A time interval to wait before executing the callback
 * @returns An instance of ScheduleCanceler that allows to cancel the scheduled callback's execution
 * @template T The callback params' type
 * @throws Error
 * @category Common Types
 */
type ScheduleFn = <T>(callback: (...args: T[]) => void, interval: number) => ScheduleCanceler; // eslint-disable-line no-unused-vars
/**
 * A function that cancels the previously scheduled callback's execution
 * @private
 * @throws Error
 * @category Common Types
 */
type CancelScheduledFn = () => void;
/**
 * A stateful abstraction over Node.js & web browser timers that cancels the scheduled task
 * @private
 * @category Common Types
 */
type ScheduleCanceler = {
  /**
   * @property A function that cancels the previously scheduled callback's execution
   */
  cancel: CancelScheduledFn;
};
/**
 * A stateful abstraction over Node.js & web browser timers that schedules a task
 * @private
 * @category Common Types
 */
type Scheduler = {
  /**
   * @property A function that schedules a given callback to run in given number of milliseconds
   */
  schedule: ScheduleFn;
};

export default waitUntil;
