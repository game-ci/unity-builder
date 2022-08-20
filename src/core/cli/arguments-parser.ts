import { parseArgv } from './parse-argv.ts';

export class ArgumentsParser {
  public parse(cliArguments: string[]) {
    const [commandName, ...rest] = cliArguments;
    const { subCommands, args } = parseArgv(rest);

    let verbosity;
    if (args.has('vvv') || args.has('max-verbose') || args.has('maxVerbose') || args.has('debug')) {
      verbosity = 3;
    } else if (args.has('vv') || args.has('very-verbose') || args.has('veryVerbose')) {
      verbosity = 2;
    } else if (args.has('v') || args.has('verbose')) {
      verbosity = 1;
    } else if (args.has('q') || args.has('quiet')) {
      verbosity = -1;
    } else {
      verbosity = 0;
    }

    return {
      commandName,
      subCommands,
      args,
      verbosity,
    };
  }
}
