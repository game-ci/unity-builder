import { CliArguments } from '../core/cli/cli-arguments.ts';
import { Parameters, Input } from '../model/index.ts';
import { CommandInterface } from '../command/command-interface.ts';
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

    log.info('Parameters generated.');

    return this;
  }
}
