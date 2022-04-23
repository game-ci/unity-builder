import { parseArgv } from '../core/parse-argv.ts';

export class ArgumentsParser {
  static parse(cliArguments: string[]) {
    const [commandName, ...arguments] = cliArguments;

    return {
      commandName,
      options: parseArgv(arguments),
    };
  }
}
