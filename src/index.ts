import './core/logger/index.ts';
import { core, process } from './dependencies.ts';
import { Action, BuildParameters, Cache, CloudRunner, Docker, ImageTag, Output } from './model/index.ts';
import { Cli } from './model/cli/cli.ts';
import MacBuilder from './model/mac-builder.ts';
import PlatformSetup from './model/platform-setup.ts';

async function runMain() {
  try {
    if (Cli.InitCliMode()) {
      // Todo - this is only here for testing the entire flow in deno and making sure I'm hitting the right path
      log.error('CloudBuilder CLI mode');
      await Cli.RunCli();

      return;
    }
    Action.checkCompatibility();
    Cache.verify();

    const { workspace, actionFolder } = Action;
    log.debug('workspace', workspace, 'actionFolder', actionFolder);

    const buildParameters = await BuildParameters.create();
    log.debug('buildParameters', buildParameters);

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
}

runMain();
