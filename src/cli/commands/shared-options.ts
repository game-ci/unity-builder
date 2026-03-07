import type { Argv } from 'yargs';

/**
 * Shared option groups for CLI commands. Avoids duplicating option
 * definitions across build, test, and orchestrate commands.
 */

export function withProjectOptions<T>(yargs: Argv<T>) {
  return yargs
    .option('target-platform', {
      alias: 'targetPlatform',
      type: 'string' as const,
      description: 'Platform that the build should target',
      demandOption: true,
    })
    .option('unity-version', {
      alias: 'unityVersion',
      type: 'string' as const,
      description: 'Version of Unity to use. Use "auto" to detect from ProjectVersion.txt.',
      default: 'auto',
    })
    .option('project-path', {
      alias: 'projectPath',
      type: 'string' as const,
      description: 'Path to the Unity project',
      default: '.',
    })
    .option('build-name', {
      alias: 'buildName',
      type: 'string' as const,
      description: 'Name of the build',
      default: '',
    })
    .option('builds-path', {
      alias: 'buildsPath',
      type: 'string' as const,
      description: 'Path where the builds should be stored',
      default: 'build',
    })
    .option('build-method', {
      alias: 'buildMethod',
      type: 'string' as const,
      description: 'Path to a Namespace.Class.StaticMethod to run to perform the build',
      default: '',
    })
    .option('custom-parameters', {
      alias: 'customParameters',
      type: 'string' as const,
      description: 'Custom parameters to configure the build',
      default: '',
    })
    .option('custom-image', {
      alias: 'customImage',
      type: 'string' as const,
      description: 'Specific docker image that should be used for building the project',
      default: '',
    })
    .option('git-private-token', {
      alias: 'gitPrivateToken',
      type: 'string' as const,
      description: 'GitHub private token for repository access',
      default: '',
    })
    .option('skip-activation', {
      alias: 'skipActivation',
      type: 'string' as const,
      description: 'Skip Unity activation/deactivation',
      default: 'false',
    })
    .option('unity-licensing-server', {
      alias: 'unityLicensingServer',
      type: 'string' as const,
      description: 'The Unity licensing server address',
      default: '',
    })
    .option('container-registry-repository', {
      alias: 'containerRegistryRepository',
      type: 'string' as const,
      description: 'Container registry and repository to pull image from. Only applicable if customImage is not set.',
      default: 'unityci/editor',
    })
    .option('container-registry-image-version', {
      alias: 'containerRegistryImageVersion',
      type: 'string' as const,
      description: 'Container registry image version. Only applicable if customImage is not set.',
      default: '3',
    });
}

export function withDockerOptions<T>(yargs: Argv<T>) {
  return yargs
    .option('docker-cpu-limit', {
      alias: 'dockerCpuLimit',
      type: 'string' as const,
      description: 'Number of CPU cores to assign the docker container',
      default: '',
    })
    .option('docker-memory-limit', {
      alias: 'dockerMemoryLimit',
      type: 'string' as const,
      description: 'Amount of memory to assign the docker container (e.g. 512m, 4g)',
      default: '',
    })
    .option('docker-workspace-path', {
      alias: 'dockerWorkspacePath',
      type: 'string' as const,
      description: 'The path to mount the workspace inside the docker container',
      default: '/github/workspace',
    })
    .option('docker-isolation-mode', {
      alias: 'dockerIsolationMode',
      type: 'string' as const,
      description:
        'Isolation mode to use for the docker container (process, hyperv, or default). Only applicable on Windows.',
      default: 'default',
    })
    .option('run-as-host-user', {
      alias: 'runAsHostUser',
      type: 'string' as const,
      description: 'Whether to run as a user that matches the host system',
      default: 'false',
    })
    .option('chown-files-to', {
      alias: 'chownFilesTo',
      type: 'string' as const,
      description: 'User and optionally group to give ownership of build artifacts',
      default: '',
    })
    .option('ssh-agent', {
      alias: 'sshAgent',
      type: 'string' as const,
      description: 'SSH Agent path to forward to the container',
      default: '',
    })
    .option('ssh-public-keys-directory-path', {
      alias: 'sshPublicKeysDirectoryPath',
      type: 'string' as const,
      description: 'Path to a directory containing SSH public keys to forward to the container',
      default: '',
    });
}

export function withAndroidOptions<T>(yargs: Argv<T>) {
  return yargs
    .option('android-version-code', {
      alias: 'androidVersionCode',
      type: 'string' as const,
      description: 'The android versionCode',
      default: '',
    })
    .option('android-export-type', {
      alias: 'androidExportType',
      type: 'string' as const,
      description: 'The android export type (androidPackage, androidAppBundle, androidStudioProject)',
      default: 'androidPackage',
    })
    .option('android-keystore-name', {
      alias: 'androidKeystoreName',
      type: 'string' as const,
      description: 'The android keystoreName',
      default: '',
    })
    .option('android-keystore-base64', {
      alias: 'androidKeystoreBase64',
      type: 'string' as const,
      description: 'The base64 contents of the android keystore file',
      default: '',
    })
    .option('android-keystore-pass', {
      alias: 'androidKeystorePass',
      type: 'string' as const,
      description: 'The android keystorePass',
      default: '',
    })
    .option('android-keyalias-name', {
      alias: 'androidKeyaliasName',
      type: 'string' as const,
      description: 'The android keyaliasName',
      default: '',
    })
    .option('android-keyalias-pass', {
      alias: 'androidKeyaliasPass',
      type: 'string' as const,
      description: 'The android keyaliasPass',
      default: '',
    })
    .option('android-target-sdk-version', {
      alias: 'androidTargetSdkVersion',
      type: 'string' as const,
      description: 'The android target API level',
      default: '',
    })
    .option('android-symbol-type', {
      alias: 'androidSymbolType',
      type: 'string' as const,
      description: 'The android symbol type to export (none, public, debugging)',
      default: 'none',
    });
}

export function withOrchestratorOptions<T>(yargs: Argv<T>) {
  return yargs
    .option('provider-strategy', {
      alias: 'providerStrategy',
      type: 'string' as const,
      description: 'Orchestrator provider: aws, k8s, local-docker, local-system',
      default: 'aws',
    })
    .option('aws-stack-name', {
      alias: 'awsStackName',
      type: 'string' as const,
      description: 'The Cloud Formation stack name (AWS provider)',
      default: 'game-ci',
    })
    .option('kube-config', {
      alias: 'kubeConfig',
      type: 'string' as const,
      description: 'Base64 encoded Kubernetes config (K8s provider)',
      default: '',
    })
    .option('kube-volume', {
      alias: 'kubeVolume',
      type: 'string' as const,
      description: 'Persistent Volume Claim name for Unity build (K8s provider)',
      default: '',
    })
    .option('kube-volume-size', {
      alias: 'kubeVolumeSize',
      type: 'string' as const,
      description: 'Disc space for Kubernetes Persistent Volume',
      default: '5Gi',
    })
    .option('kube-storage-class', {
      alias: 'kubeStorageClass',
      type: 'string' as const,
      description: 'Kubernetes storage class to use for orchestrator jobs. Leave empty to install rook cluster.',
      default: '',
    })
    .option('container-cpu', {
      alias: 'containerCpu',
      type: 'string' as const,
      description: 'CPU allocation for remote build container',
      default: '1024',
    })
    .option('container-memory', {
      alias: 'containerMemory',
      type: 'string' as const,
      description: 'Memory allocation for remote build container',
      default: '3072',
    })
    .option('cache-key', {
      alias: 'cacheKey',
      type: 'string' as const,
      description: 'Cache key to indicate bucket for cache',
      default: '',
    })
    .option('allow-dirty-build', {
      alias: 'allowDirtyBuild',
      type: 'boolean' as const,
      description: 'Allow builds from dirty branches',
      default: false,
    })
    .option('watch-to-end', {
      alias: 'watchToEnd',
      type: 'string' as const,
      description: 'Whether to watch the build to completion',
      default: 'true',
    })
    .option('clone-depth', {
      alias: 'cloneDepth',
      type: 'string' as const,
      description: 'Git clone depth (0 for full clone)',
      default: '50',
    })
    .option('read-input-from-override-list', {
      alias: 'readInputFromOverrideList',
      type: 'string' as const,
      description: 'Comma separated list of input value names to read from the input override command',
      default: '',
    })
    .option('read-input-override-command', {
      alias: 'readInputOverrideCommand',
      type: 'string' as const,
      description: 'Command to execute to pull input from an external source (e.g. cloud provider secret managers)',
      default: '',
    })
    .option('post-build-steps', {
      alias: 'postBuildSteps',
      type: 'string' as const,
      description:
        'Post build job in yaml format with the keys image, secrets (name, value object array), command string',
      default: '',
    })
    .option('pre-build-steps', {
      alias: 'preBuildSteps',
      type: 'string' as const,
      description:
        'Pre build job after repository setup but before the build job (yaml format with keys image, secrets, command)',
      default: '',
    })
    .option('custom-job', {
      alias: 'customJob',
      type: 'string' as const,
      description:
        'Custom job instead of the standard build automation (yaml format with keys image, secrets, command)',
      default: '',
    });
}
