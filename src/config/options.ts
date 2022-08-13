import { CliArguments } from '../core/cli/cli-arguments.ts';
import { Parameters, Input } from '../model/index.ts';
import { CommandInterface } from '../commands/command/command-interface.ts';
import { Environment } from '../core/env/environment.ts';

export class Options {
  public input: Input;
  public parameters: Parameters;
  private readonly env: Environment;
  private command: CommandInterface;

  constructor(command: CommandInterface, env: Environment) {
    this.env = env;
    this.command = command;

    return this;
  }

  public async generateParameters(args: CliArguments) {
    this.input = new Input(args);
    this.parameters = await new Parameters(this.input, this.env).registerCommand(this.command).parse();

    log.debug('Parameters generated.');

    return this;
  }

  registerCommand(command: CommandInterface) {
    this.command = command;

    return this;
  }
}
