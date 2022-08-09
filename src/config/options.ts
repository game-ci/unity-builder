import { CliArguments } from '../core/cli/cli-arguments.ts';
import { EnvVariables } from '../core/env/env-variables.ts';
import { Parameters, Input } from '../model/index.ts';

export class Options {
  public input: Input;
  public parameters: Parameters;

  constructor(env: EnvVariables) {
    this.env = env;

    return this;
  }

  public async generateParameters(args: CliArguments) {
    this.input = new Input(args);
    this.parameters = await new Parameters(this.input, this.env).parse();

    log.debug('Parameters generated.');

    return this;
  }
}
