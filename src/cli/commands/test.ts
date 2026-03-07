import type { CommandModule } from 'yargs';
import * as core from '@actions/core';
import { BuildParameters, ImageTag } from '../../model';
import { mapCliArgumentsToInput, CliArguments } from '../input-mapper';
import Docker from '../../model/docker';
import Action from '../../model/action';
import PlatformSetup from '../../model/platform-setup';
import { withProjectOptions, withDockerOptions } from './shared-options';

interface TestArguments extends CliArguments {
  targetPlatform: string;
  testMode?: string;
}

const testCommand: CommandModule<object, TestArguments> = {
  command: ['test', 't'],
  describe: 'Run tests for a Unity project',
  builder: (yargs) => {
    let y = withProjectOptions(yargs);
    y = withDockerOptions(y);

    return y
      .option('test-mode', {
        alias: 'testMode',
        type: 'string',
        description: 'The mode to run tests in (EditMode, PlayMode, or All)',
        default: 'All',
        choices: ['EditMode', 'PlayMode', 'All'],
      })
      .option('test-results-path', {
        alias: 'testResultsPath',
        type: 'string',
        description: 'Path where test results XML should be stored',
        default: 'test-results',
      })
      .option('test-category', {
        alias: 'testCategory',
        type: 'string',
        description: 'Only run tests in the given category (semicolon-separated)',
        default: '',
      })
      .option('test-filter', {
        alias: 'testFilter',
        type: 'string',
        description: 'Only run tests that match the filter (semicolon-separated)',
        default: '',
      })
      .option('coverage-options', {
        alias: 'coverageOptions',
        type: 'string',
        description: 'Options for code coverage (e.g. assemblyFilters, pathFilters)',
        default: '',
      })
      .option('enable-code-coverage', {
        alias: 'enableCodeCoverage',
        type: 'boolean',
        description: 'Enable code coverage when running tests',
        default: false,
      })
      .option('versioning', {
        type: 'string',
        description: 'The versioning scheme to use',
        default: 'None',
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
      .example('game-ci test --target-platform StandaloneLinux64', 'Run all tests for Linux platform')
      .example(
        'game-ci t --target-platform StandaloneLinux64 --test-mode EditMode',
        'Run only EditMode tests (short alias)',
      )
      .example(
        'game-ci test --target-platform StandaloneLinux64 --enable-code-coverage',
        'Run tests with code coverage',
      ) as any;
  },
  handler: async (cliArguments) => {
    try {
      // Map test-specific flags into the input system
      mapCliArgumentsToInput(cliArguments);

      const buildParameters = await BuildParameters.create();
      const baseImage = new ImageTag(buildParameters);

      const testMode = cliArguments.testMode || 'All';

      core.info(`Running Unity tests (${testMode})...`);
      core.info(`Target platform: ${buildParameters.targetPlatform}`);
      core.info(`Unity version: ${buildParameters.editorVersion}`);
      core.info(`Project path: ${buildParameters.projectPath}`);

      const actionFolder = Action.actionFolder;
      await PlatformSetup.setup(buildParameters, actionFolder);

      const exitCode = await Docker.run(baseImage.toString(), {
        workspace: process.cwd(),
        actionFolder,
        ...buildParameters,
      });

      const resultsPath = cliArguments.testResultsPath || 'test-results';
      core.info(`\nTests completed with exit code: ${exitCode}`);
      core.info(`Test results: ${resultsPath}`);

      if (exitCode !== 0) {
        throw new Error(`Tests failed with exit code ${exitCode}`);
      }
    } catch (error: any) {
      core.setFailed(`Tests failed: ${error.message}`);

      throw error;
    }
  },
};

export default testCommand;
