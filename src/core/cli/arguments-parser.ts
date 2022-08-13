import { parseArgv } from './parse-argv.ts';

export class ArgumentsParser {
  public parse(cliArguments: string[]) {
    const [commandName, ...rest] = cliArguments;
    const { subCommands, args } = parseArgv(rest);

    return {
      commandName,
      subCommands,
      args,
    };
  }
}
