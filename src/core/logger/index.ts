import * as log from 'https://deno.land/std@0.151.0/log/mod.ts';
import { fileFormatter, consoleFormatter } from './formatter.ts';
import { getHomeDir, fsSync as fs } from '../../dependencies.ts';

export enum Verbosity {
  quiet = -1,
  normal = 0,
  verbose = 1,
  veryVerbose = 2,
  maxVerbose = 3,
}

export const configureLogger = async (verbosity: Verbosity) => {
  // Verbosity
  const isQuiet = verbosity === Verbosity.quiet;
  const isVerbose = verbosity >= Verbosity.verbose;
  const isVeryVerbose = verbosity >= Verbosity.veryVerbose;
  const isMaxVerbose = verbosity >= Verbosity.maxVerbose;

  // Config folder
  const configFolder = `${getHomeDir()}/.game-ci`;
  await fs.ensureDir(configFolder);

  // Handlers
  let consoleLevel = 'INFO';
  if (isQuiet) consoleLevel = 'ERROR';
  if (isVerbose) consoleLevel = 'DEBUG';
  const consoleHandler = new log.handlers.ConsoleHandler(consoleLevel, { formatter: consoleFormatter });
  const fileHandler = new log.handlers.FileHandler('WARNING', {
    filename: `${configFolder}/game-ci.log`,
    formatter: fileFormatter,
  });

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

  // Verbosity
  window.log.verbosity = verbosity;
  window.log.verbosityName = Verbosity[verbosity];
  window.log.isQuiet = isQuiet;
  window.log.isVerbose = isVerbose;
  window.log.isVeryVerbose = isVeryVerbose;
  window.log.isMaxVerbose = isMaxVerbose;
};
