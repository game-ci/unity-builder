import { CliArguments } from '../core/cli/cli-arguments.ts';
import { EnvVariables } from '../core/env/env-variables.ts';
import { Parameters, Input } from '../model/index.ts';
import { CommandInterface } from '../commands/command/command-interface.ts';

export class Options {
  public input: Input;
  public parameters: Parameters;
  private readonly env: EnvVariables;
  private readonly command: CommandInterface;

  constructor(command: CommandInterface, env: EnvVariables) {
    this.input = null;
    this.parameters = null;
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
}
