import { CommandInterface } from './CommandInterface.ts';
import { exec, OutputMode } from 'https://deno.land/x/exec@0.0.5/mod.ts';
import { Options } from '../../config/options.ts';

export class BuildCommand implements CommandInterface {
  public readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  public async execute(options: Options) {
    const result = await exec('docker run -it unityci/editor:2020.3.15f2-base-1 /bin/bash -c "echo test"', {
      output: OutputMode.Capture,
      continueOnError: true,

      // verbose: true,
    });

    console.log(options);
    console.log(result.output);
  }
}
