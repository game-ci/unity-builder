import { exec, OutputMode } from 'https://deno.land/x/exec@0.0.5/mod.ts';
import { CommandInterface } from '../command-interface.ts';
import { Options } from '../../../config/options.ts';
import { Action, Cache, Docker, ImageTag, Input, Output } from '../../../model/index.ts';
import PlatformSetup from '../../../model/platform-setup.ts';
import MacBuilder from '../../../model/mac-builder.ts';
import Parameters from '../../../model/parameters.ts';

export class BuildCommand implements CommandInterface {
  public readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  public async parseParameters(input: Input, parameters: Parameters) {}

  public async execute(options: Options): Promise<boolean> {
    try {
      const { workspace, actionFolder } = Action;
      const { parameters, env } = options;

      Action.checkCompatibility();
      Cache.verify();

      const baseImage = new ImageTag(parameters);
      log.debug('baseImage', baseImage);

      await PlatformSetup.setup(parameters, actionFolder);
      log.info('Platform setup done.');
      log.info('OS:', env.getOS());
      if (env.getOS() === 'darwin') {
        MacBuilder.run(actionFolder, workspace, parameters);
      } else {
        await Docker.run(baseImage, { workspace, actionFolder, ...parameters });
      }

      // Set output
      await Output.setBuildVersion(parameters.buildVersion);
    } catch (error) {
      log.error(error);
      Deno.exit(1);
    }

    const result = await exec('docker run -it unityci/editor:2020.3.15f2-base-1 /bin/bash -c "echo test"', {
      output: OutputMode.Capture,
      continueOnError: true,

      // verbose: true,
    });

    log.info('result', result.output);
    const { success } = result.status;
    log.info('success', success);

    return success;
  }
}
