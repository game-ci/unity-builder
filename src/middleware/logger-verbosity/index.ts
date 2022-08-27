import { configureLogger as createLoggerAndSetVerbosity } from '../../core/logger/index.ts';

export const configureLogger = async (argv) => {
  const { quiet, verbose, veryVerbose, maxVerbose } = argv;

  let verbosity;
  if (maxVerbose) {
    verbosity = 3;
  } else if (veryVerbose) {
    verbosity = 2;
  } else if (verbose) {
    verbosity = 1;
  } else if (quiet) {
    verbosity = -1;
  } else {
    verbosity = 0;
  }

  await createLoggerAndSetVerbosity(verbosity);
};
