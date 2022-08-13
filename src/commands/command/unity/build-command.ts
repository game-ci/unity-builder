import { exec, OutputMode } from 'https://deno.land/x/exec@0.0.5/mod.ts';
import { CommandInterface } from '../command-interface.ts';
import { Options } from '../../../config/options.ts';
import { Action, Cache, CloudRunner, Docker, ImageTag, Input, Output } from '../../../model/index.ts';
import PlatformSetup from '../../../model/platform-setup.ts';
import { core, process } from '../../../dependencies.ts';
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
      log.info('options', options);
      const { workspace, actionFolder } = Action;
      const { buildParameters } = options;

      Action.checkCompatibility();
      Cache.verify();

      const baseImage = new ImageTag(buildParameters);
      log.debug('baseImage', baseImage);

      if (buildParameters.cloudRunnerCluster !== 'local') {
        await CloudRunner.run(buildParameters, baseImage.toString());
      } else {
        log.info('Building locally');
        await PlatformSetup.setup(buildParameters, actionFolder);
        if (process.platform === 'darwin') {
          MacBuilder.run(actionFolder, workspace, buildParameters);
        } else {
          await Docker.run(baseImage, { workspace, actionFolder, ...buildParameters });
        }
      }

      // Set output
      await Output.setBuildVersion(buildParameters.buildVersion);
    } catch (error) {
      log.error(error);
      core.setFailed((error as Error).message);
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
