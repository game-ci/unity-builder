/* eslint-disable no-console */
import { exec, OutputMode } from 'https://deno.land/x/exec@0.0.5/mod.ts';
import { CliOptions } from '../core/cli-options.ts';

export class Bootstrapper {
  private readonly options: CliOptions;

  constructor(cliOptions: CliOptions) {
    this.options = cliOptions;
  }

  public async run() {
    console.log('using options', this.options);

    const result = await exec('docker run -it unityci/editor:2020.3.15f2-base-1 /bin/bash -c "echo test"', {
      output: OutputMode.Capture,
      continueOnError: true,

      // verbose: true,
    });

    console.log(result.output);
  }
}
