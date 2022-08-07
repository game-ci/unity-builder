import { CommandInterface } from './command-interface.ts';
import { Options } from '../../config/options.ts';
import { CloudRunner, ImageTag, Output } from '../../model/index.ts';
import { core } from '../../dependencies.ts';

// Todo - Verify this entire flow
export class BuildRemoteCommand implements CommandInterface {
  public readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  public async execute(options: Options): Promise<boolean> {
    try {
      const { buildParameters } = options;
      const baseImage = new ImageTag(buildParameters);

      const result = await CloudRunner.run(buildParameters, baseImage.toString());
      const { status, output } = result;

      await Output.setBuildVersion(buildParameters.buildVersion);

      return status.success;
    } catch (error) {
      log.error(error);
      core.setFailed((error as Error).message);
    }
  }
}
