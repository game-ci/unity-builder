import { CliOptions } from '../core/cli-options.ts';

export class Options {
  public options: CliOptions;

  constructor(optionsFromCli) {
    this.options = optionsFromCli;
  }
}
