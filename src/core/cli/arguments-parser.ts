import { parseArgv } from './parse-argv.ts';

export class ArgumentsParser {
  public parse(cliArguments: string[]) {
    const [commandName, ...args] = cliArguments;

    return {
      commandName,
      args: parseArgv(args),
    };
  }
}
