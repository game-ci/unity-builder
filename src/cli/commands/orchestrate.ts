import type { CommandModule } from 'yargs';
import * as core from '@actions/core';
import { BuildParameters, ImageTag, Orchestrator } from '../../model';
import { mapCliArgumentsToInput, CliArguments } from '../input-mapper';

interface OrchestrateArguments extends CliArguments {
  targetPlatform: string;
  providerStrategy?: string;
}

const orchestrateCommand: CommandModule<object, OrchestrateArguments> = {
  command: 'orchestrate',
  describe: 'Run a build via orchestrator providers (AWS, Kubernetes, etc.)',
  builder: (yargs) => {
    return yargs
      .option('target-platform', {
        alias: 'targetPlatform',
        type: 'string',
        description: 'Platform that the build should target',
        demandOption: true,
      })
      .option('provider-strategy', {
        alias: 'providerStrategy',
        type: 'string',
        description: 'Orchestrator provider: aws, k8s, local-docker, local-system',
        default: 'aws',
      })
      .option('unity-version', {
        alias: 'unityVersion',
        type: 'string',
        description: 'Version of Unity to use for building',
        default: 'auto',
      })
      .option('project-path', {
        alias: 'projectPath',
        type: 'string',
        description: 'Path to the Unity project to be built',
        default: '.',
      })
      .option('build-name', {
        alias: 'buildName',
        type: 'string',
        description: 'Name of the build',
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
        description: 'The versioning scheme to use',
        default: 'None',
      })
      .option('aws-stack-name', {
        alias: 'awsStackName',
        type: 'string',
        description: 'The Cloud Formation stack name (AWS provider)',
        default: 'game-ci',
      })
      .option('kube-config', {
        alias: 'kubeConfig',
        type: 'string',
        description: 'Base64 encoded Kubernetes config (K8s provider)',
        default: '',
      })
      .option('kube-volume', {
        alias: 'kubeVolume',
        type: 'string',
        description: 'Persistent Volume Claim name for Unity build (K8s provider)',
        default: '',
      })
      .option('kube-volume-size', {
        alias: 'kubeVolumeSize',
        type: 'string',
        description: 'Disc space for Kubernetes Persistent Volume',
        default: '5Gi',
      })
      .option('container-cpu', {
        alias: 'containerCpu',
        type: 'string',
        description: 'CPU allocation for remote build container',
        default: '1024',
      })
      .option('container-memory', {
        alias: 'containerMemory',
        type: 'string',
        description: 'Memory allocation for remote build container',
        default: '3072',
      })
      .option('cache-key', {
        alias: 'cacheKey',
        type: 'string',
        description: 'Cache key to indicate bucket for cache',
        default: '',
      })
      .option('git-private-token', {
        alias: 'gitPrivateToken',
        type: 'string',
        description: 'GitHub private token for repository access',
        default: '',
      })
      .option('allow-dirty-build', {
        alias: 'allowDirtyBuild',
        type: 'boolean',
        description: 'Allow builds from dirty branches',
        default: false,
      })
      .option('watch-to-end', {
        alias: 'watchToEnd',
        type: 'string',
        description: 'Whether to watch the build to completion',
        default: 'true',
      })
      .option('clone-depth', {
        alias: 'cloneDepth',
        type: 'string',
        description: 'Git clone depth (0 for full clone)',
        default: '50',
      })
      .option('skip-activation', {
        alias: 'skipActivation',
        type: 'string',
        description: 'Skip Unity activation/deactivation',
        default: 'false',
      })
      .option('kube-storage-class', {
        alias: 'kubeStorageClass',
        type: 'string',
        description: 'Kubernetes storage class to use for orchestrator jobs. Leave empty to install rook cluster.',
        default: '',
      })
      .option('read-input-from-override-list', {
        alias: 'readInputFromOverrideList',
        type: 'string',
        description: 'Comma separated list of input value names to read from the input override command',
        default: '',
      })
      .option('read-input-override-command', {
        alias: 'readInputOverrideCommand',
        type: 'string',
        description: 'Command to execute to pull input from an external source (e.g. cloud provider secret managers)',
        default: '',
      })
      .option('post-build-steps', {
        alias: 'postBuildSteps',
        type: 'string',
        description:
          'Post build job in yaml format with the keys image, secrets (name, value object array), command string',
        default: '',
      })
      .option('pre-build-steps', {
        alias: 'preBuildSteps',
        type: 'string',
        description:
          'Pre build job after repository setup but before the build job (yaml format with keys image, secrets, command)',
        default: '',
      })
      .option('custom-job', {
        alias: 'customJob',
        type: 'string',
        description:
          'Custom job instead of the standard build automation (yaml format with keys image, secrets, command)',
        default: '',
      })
      .example(
        'game-ci orchestrate --target-platform StandaloneLinux64 --provider-strategy aws',
        'Build on AWS using the orchestrator',
      )
      .example(
        'game-ci orchestrate --target-platform StandaloneLinux64 --provider-strategy k8s --kube-config <base64>',
        'Build on Kubernetes',
      ) as any;
  },
  handler: async (cliArguments) => {
    try {
      mapCliArgumentsToInput(cliArguments);

      const buildParameters = await BuildParameters.create();
      const baseImage = new ImageTag(buildParameters);

      core.info(`Orchestrating build via ${buildParameters.providerStrategy}...`);
      core.info(`Target platform: ${buildParameters.targetPlatform}`);
      core.info(`Unity version: ${buildParameters.editorVersion}`);
      core.info(`Build GUID: ${buildParameters.buildGuid}`);

      const result = await Orchestrator.run(buildParameters, baseImage.toString());

      core.info(`\nOrchestrated build completed.`);
      if (result?.BuildResults) {
        core.info(`Results: ${result.BuildResults}`);
      } else {
        core.warning('Build completed but no build results were returned.');
      }
    } catch (error: any) {
      core.setFailed(`Orchestrated build failed: ${error.message}`);

      throw error;
    }
  },
};

export default orchestrateCommand;
