import { CommandInterface } from '../command-interface.ts';
import { Action, Cache, Docker, ImageTag, Input, Output } from '../../model/index.ts';
import PlatformSetup from '../../model/platform-setup.ts';
import MacBuilder from '../../model/mac-builder.ts';
import { CommandBase } from '../command-base.ts';
import { UnityOptions } from '../../command-options/unity-options.ts';
import { YargsInstance, YargsArguments } from '../../dependencies.ts';
import { VersioningOptions } from '../../command-options/versioning-options.ts';
import { BuildOptions } from '../../command-options/build-options.ts';

export class UnityBuildCommand extends CommandBase implements CommandInterface {
  public async execute(options: YargsArguments): Promise<boolean> {
    // Todo - rework this without needing this.options, use parameters from cli instead.
    // const { workspace, actionFolder } = Action;
    // const { parameters, env } = this.options;
    //
    // Action.checkCompatibility();
    // Cache.verify();
    //
    // const baseImage = new ImageTag(options);
    // log.debug('baseImage', baseImage);
    //
    // await PlatformSetup.setup(parameters, actionFolder);
    // if (env.getOS() === 'darwin') {
    //   MacBuilder.run(actionFolder, workspace, parameters);
    // } else {
    //   await Docker.run(baseImage, { workspace, actionFolder, ...parameters });
    // }
    //
    // // Set output
    // await Output.setBuildVersion(parameters.buildVersion);

    return true;
  }

  public async configureOptions(yargs: YargsInstance): Promise<void> {
    await UnityOptions.configure(yargs);
    await VersioningOptions.configure(yargs);
    await BuildOptions.configure(yargs);
  }
}
