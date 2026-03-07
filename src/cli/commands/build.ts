import type { CommandModule } from 'yargs';
import * as core from '@actions/core';
import { BuildParameters, ImageTag } from '../../model';
import { mapCliArgumentsToInput, CliArguments } from '../input-mapper';
import MacBuilder from '../../model/mac-builder';
import Docker from '../../model/docker';
import Action from '../../model/action';
import PlatformSetup from '../../model/platform-setup';
import { withProjectOptions, withDockerOptions, withAndroidOptions } from './shared-options';

interface BuildArguments extends CliArguments {
  targetPlatform: string;
}

const buildCommand: CommandModule<object, BuildArguments> = {
  command: 'build',
  describe: 'Build a Unity project locally via Docker or native runner',
  builder: (yargs) => {
    let y = withProjectOptions(yargs);
    y = withAndroidOptions(y);
    y = withDockerOptions(y);

    return y
      .option('build-profile', {
        alias: 'buildProfile',
        type: 'string',
        description: 'Path to the build profile to activate, relative to the project root',
        default: '',
      })
      .option('versioning', {
        type: 'string',
        description: 'The versioning scheme to use when building the project',
        default: 'Semantic',
      })
      .option('version', {
        type: 'string',
        description: 'The version, when used with the "Custom" versioning scheme',
        default: '',
      })
      .option('manual-exit', {
        alias: 'manualExit',
        type: 'boolean',
        description: 'Suppresses -quit. Exit your build method using EditorApplication.Exit(0) instead.',
        default: false,
      })
      .option('enable-gpu', {
        alias: 'enableGpu',
        type: 'boolean',
        description: 'Launches unity without specifying -nographics',
        default: false,
      })
      .option('cache-unity-installation-on-mac', {
        alias: 'cacheUnityInstallationOnMac',
        type: 'boolean',
        description: 'Whether to cache the Unity hub and editor installation on MacOS',
        default: false,
      })
      .option('unity-hub-version-on-mac', {
        alias: 'unityHubVersionOnMac',
        type: 'string',
        description: 'The version of Unity Hub to install on MacOS (e.g. 3.4.0). Defaults to latest available on brew.',
        default: '',
      })
      .example('game-ci build --target-platform StandaloneLinux64', 'Build for Linux using auto-detected Unity version')
      .example(
        'game-ci build --target-platform Android --unity-version 2022.3.56f1 --build-method MyBuild.Run',
        'Build for Android with a specific Unity version and build method',
      ) as any;
  },
  handler: async (cliArguments) => {
    try {
      mapCliArgumentsToInput(cliArguments);

      const buildParameters = await BuildParameters.create();
      const baseImage = new ImageTag(buildParameters);

      core.info(`Building locally for ${buildParameters.targetPlatform}...`);
      core.info(`Unity version: ${buildParameters.editorVersion}`);
      core.info(`Project path: ${buildParameters.projectPath}`);

      const actionFolder = Action.actionFolder;
      await PlatformSetup.setup(buildParameters, actionFolder);

      const exitCode =
        process.platform === 'darwin'
          ? await MacBuilder.run(actionFolder)
          : await Docker.run(baseImage.toString(), {
              workspace: process.cwd(),
              actionFolder,
              ...buildParameters,
            });

      core.info(`\nBuild completed with exit code: ${exitCode}`);
      core.info(`Build version: ${buildParameters.buildVersion}`);
      core.info(`Build path: ${buildParameters.buildPath}`);

      if (exitCode !== 0) {
        throw new Error(`Build failed with exit code ${exitCode}`);
      }
    } catch (error: any) {
      core.setFailed(`Build failed: ${error.message}`);

      throw error;
    }
  },
};

export default buildCommand;
