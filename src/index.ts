import './core/logger/index.ts';
import type { CommandInterface } from './commands/command/command-interface.ts';
import type { EnvVariables } from './core/env/env-variables.ts';
import { Options } from './config/options.ts';
import { CommandFactory } from './commands/command-factory.ts';
import { ArgumentsParser } from './core/cli/arguments-parser.ts';
import System from './model/system.ts';

export class GameCI {
  private readonly commandFactory: CommandFactory;
  private readonly argumentsParser: ArgumentsParser;
  private readonly env: EnvVariables;

  private options?: Options;
  private command?: CommandInterface;

  constructor(envVariables: EnvVariables) {
    this.env = envVariables;

    this.commandFactory = new CommandFactory();
    this.argumentsParser = new ArgumentsParser();
  }

  public async run(cliArguments: string[]) {
    try {
      const { commandName, args } = this.argumentsParser.parse(cliArguments);

      this.options = await new Options(this.env).generateParameters(args);
      this.command = this.commandFactory.createCommand(commandName);

      await this.command.execute(this.options);
    } catch (error) {
      log.error(error);
      Deno.exit(1);
    }
  }
}

await new GameCI(Deno.env.toObject()).run(Deno.args);
