import type { CommandModule } from 'yargs';
import * as core from '@actions/core';
import { BuildParameters, ImageTag, Orchestrator } from '../../model';
import { mapCliArgumentsToInput, CliArguments } from '../input-mapper';
import MacBuilder from '../../model/mac-builder';
import Docker from '../../model/docker';
import Action from '../../model/action';
import PlatformSetup from '../../model/platform-setup';

interface BuildArguments extends CliArguments {
  targetPlatform: string;
}

const buildCommand: CommandModule<object, BuildArguments> = {
  command: 'build',
  describe: 'Build a Unity project',
  builder: (yargs) => {
    return yargs
      .option('target-platform', {
        alias: 'targetPlatform',
        type: 'string',
        description: 'Platform that the build should target',
        demandOption: true,
      })
      .option('unity-version', {
        alias: 'unityVersion',
        type: 'string',
        description: 'Version of Unity to use for building the project. Use "auto" to detect.',
        default: 'auto',
      })
      .option('project-path', {
        alias: 'projectPath',
        type: 'string',
        description: 'Path to the Unity project to be built',
        default: '.',
      })
      .option('build-profile', {
        alias: 'buildProfile',
        type: 'string',
        description: 'Path to the build profile to activate, relative to the project root',
        default: '',
      })
      .option('build-name', {
        alias: 'buildName',
        type: 'string',
        description: 'Name of the build (no file extension)',
        default: '',
      })
      .option('builds-path', {
        alias: 'buildsPath',
        type: 'string',
        description: 'Path where the builds should be stored',
        default: 'build',
      })
      .option('build-method', {
        alias: 'buildMethod',
        type: 'string',
        description: 'Path to a Namespace.Class.StaticMethod to run to perform the build',
        default: '',
      })
      .option('custom-parameters', {
        alias: 'customParameters',
        type: 'string',
        description: 'Custom parameters to configure the build',
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
      .option('custom-image', {
        alias: 'customImage',
        type: 'string',
        description: 'Specific docker image that should be used for building the project',
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
      .option('android-version-code', {
        alias: 'androidVersionCode',
        type: 'string',
        description: 'The android versionCode',
        default: '',
      })
      .option('android-export-type', {
        alias: 'androidExportType',
        type: 'string',
        description: 'The android export type (androidPackage, androidAppBundle, androidStudioProject)',
        default: 'androidPackage',
      })
      .option('android-keystore-name', {
        alias: 'androidKeystoreName',
        type: 'string',
        description: 'The android keystoreName',
        default: '',
      })
      .option('android-keystore-base64', {
        alias: 'androidKeystoreBase64',
        type: 'string',
        description: 'The base64 contents of the android keystore file',
        default: '',
      })
      .option('android-keystore-pass', {
        alias: 'androidKeystorePass',
        type: 'string',
        description: 'The android keystorePass',
        default: '',
      })
      .option('android-keyalias-name', {
        alias: 'androidKeyaliasName',
        type: 'string',
        description: 'The android keyaliasName',
        default: '',
      })
      .option('android-keyalias-pass', {
        alias: 'androidKeyaliasPass',
        type: 'string',
        description: 'The android keyaliasPass',
        default: '',
      })
      .option('android-target-sdk-version', {
        alias: 'androidTargetSdkVersion',
        type: 'string',
        description: 'The android target API level',
        default: '',
      })
      .option('android-symbol-type', {
        alias: 'androidSymbolType',
        type: 'string',
        description: 'The android symbol type to export (none, public, debugging)',
        default: 'none',
      })
      .option('docker-cpu-limit', {
        alias: 'dockerCpuLimit',
        type: 'string',
        description: 'Number of CPU cores to assign the docker container',
        default: '',
      })
      .option('docker-memory-limit', {
        alias: 'dockerMemoryLimit',
        type: 'string',
        description: 'Amount of memory to assign the docker container (e.g. 512m, 4g)',
        default: '',
      })
      .option('docker-workspace-path', {
        alias: 'dockerWorkspacePath',
        type: 'string',
        description: 'The path to mount the workspace inside the docker container',
        default: '/github/workspace',
      })
      .option('run-as-host-user', {
        alias: 'runAsHostUser',
        type: 'string',
        description: 'Whether to run as a user that matches the host system',
        default: 'false',
      })
      .option('chown-files-to', {
        alias: 'chownFilesTo',
        type: 'string',
        description: 'User and optionally group to give ownership of build artifacts',
        default: '',
      })
      .option('ssh-agent', {
        alias: 'sshAgent',
        type: 'string',
        description: 'SSH Agent path to forward to the container',
        default: '',
      })
      .option('git-private-token', {
        alias: 'gitPrivateToken',
        type: 'string',
        description: 'GitHub private token to pull from GitHub',
        default: '',
      })
      .option('provider-strategy', {
        alias: 'providerStrategy',
        type: 'string',
        description: 'Execution strategy: local, k8s, or aws',
        default: 'local',
      })
      .option('skip-activation', {
        alias: 'skipActivation',
        type: 'string',
        description: 'Skip the activation/deactivation of Unity',
        default: 'false',
      })
      .option('unity-licensing-server', {
        alias: 'unityLicensingServer',
        type: 'string',
        description: 'The Unity licensing server address',
        default: '',
      })
      .option('container-registry-repository', {
        alias: 'containerRegistryRepository',
        type: 'string',
        description: 'Container registry and repository to pull image from. Only applicable if customImage is not set.',
        default: 'unityci/editor',
      })
      .option('container-registry-image-version', {
        alias: 'containerRegistryImageVersion',
        type: 'string',
        description: 'Container registry image version. Only applicable if customImage is not set.',
        default: '3',
      })
      .option('docker-isolation-mode', {
        alias: 'dockerIsolationMode',
        type: 'string',
        description:
          'Isolation mode to use for the docker container (process, hyperv, or default). Only applicable on Windows.',
        default: 'default',
      })
      .option('ssh-public-keys-directory-path', {
        alias: 'sshPublicKeysDirectoryPath',
        type: 'string',
        description: 'Path to a directory containing SSH public keys to forward to the container',
        default: '',
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

      let exitCode = -1;

      if (buildParameters.providerStrategy === 'local') {
        core.info(`Building locally for ${buildParameters.targetPlatform}...`);
        core.info(`Unity version: ${buildParameters.editorVersion}`);
        core.info(`Project path: ${buildParameters.projectPath}`);

        const actionFolder = Action.actionFolder;
        await PlatformSetup.setup(buildParameters, actionFolder);

        exitCode =
          process.platform === 'darwin'
            ? await MacBuilder.run(actionFolder)
            : await Docker.run(baseImage.toString(), {
                workspace: process.cwd(),
                actionFolder,
                ...buildParameters,
              });
      } else {
        core.info(`Building via orchestrator (${buildParameters.providerStrategy})...`);
        await Orchestrator.run(buildParameters, baseImage.toString());
        exitCode = 0;
      }

      // Output results
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
