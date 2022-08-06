import * as log from 'https://deno.land/std@0.151.0/log/mod.ts';
import { fileFormatter, consoleFormatter } from './formatter.ts';

// Handlers
const consoleHandler = new log.handlers.ConsoleHandler('DEBUG', { formatter: consoleFormatter });
const fileHandler = new log.handlers.FileHandler('WARNING', { filename: './game-ci.log', formatter: fileFormatter });

// Make sure it saves on Ctrl+C interrupt https://github.com/denoland/deno_std/issues/2193
Deno.addSignalListener('SIGINT', () => fileHandler.flush());

await log.setup({
  handlers: {
    consoleHandler,
    fileHandler,
  },

  loggers: {
    default: {
      level: 'DEBUG',
      handlers: ['consoleHandler', 'fileHandler'],
    },
  },
});

/**
 * Allows using `log.debug` and other methods directly from anywhere
 *
 * Example
 *   log.debug('something', [{ a: { b: { c: { d: ['a', 'b'] } } } }], 'something', {
 *     a: { b: { c: { d: { e: { f: { g: 'foo' } } } } } },
 *   });
 *
 * Outputs:
 *   [DEBUG] something [ { a: { b: [Object] } } ] something { a: { b: { c: [Object] } } }
 */
window.log = log.getLogger();
