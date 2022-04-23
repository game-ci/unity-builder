import { CommandFactory } from './commands/command-factory.ts';
import { ArgumentsParser } from './arguments-parser/arguments-parser.ts';
import { Options } from './config/options.ts';
import { CommandInterface } from './commands/command/CommandInterface.ts';

export class Bootstrapper {
  private readonly commandFactory: CommandFactory;
  private readonly argumentsParser: ArgumentsParser;

  private options?: Options;
  private command?: CommandInterface;

  constructor() {
    this.commandFactory = new CommandFactory();
    this.argumentsParser = ArgumentsParser;
  }

  public async run(cliArguments: string[]) {
    const { commandName, options } = this.argumentsParser.parse(cliArguments);

    this.options = new Options(options);
    this.command = this.commandFactory.createCommand(commandName);

    // Command agnostic stuff here

    await this.command.execute(this.options);
  }
}
