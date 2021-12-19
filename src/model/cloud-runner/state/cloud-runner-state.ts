import { BuildParameters } from '../..';
import ImageEnvironmentFactory from '../../image-environment-factory';
import CloudRunnerEnvironmentVariable from '../services/cloud-runner-environment-variable';
import CloudRunnerLogger from '../services/cloud-runner-logger';
import CloudRunnerNamespace from '../services/cloud-runner-namespace';
import { CloudRunnerProviderInterface } from '../services/cloud-runner-provider-interface';
import CloudRunnerSecret from '../services/cloud-runner-secret';

export class CloudRunnerState {
  static setup(buildParameters: BuildParameters) {
    CloudRunnerState.buildParams = buildParameters;
    if (CloudRunnerState.buildGuid === undefined) {
      CloudRunnerState.buildGuid = CloudRunnerNamespace.generateBuildName(
        CloudRunnerState.runNumber,
        buildParameters.platform,
      );
    }
    CloudRunnerState.setupDefaultSecrets();
  }
  public static CloudRunnerProviderPlatform: CloudRunnerProviderInterface;
  public static buildParams: BuildParameters;
  public static defaultSecrets: CloudRunnerSecret[];
  public static buildGuid: string;
  public static get branchName(): string {
    return CloudRunnerState.buildParams.branch;
  }
  public static get buildPathFull(): string {
    return `/${CloudRunnerState.buildVolumeFolder}/${CloudRunnerState.buildGuid}`;
  }
  public static get builderPathFull(): string {
    return `${CloudRunnerState.buildPathFull}/builder`;
  }
  public static get steamPathFull(): string {
    return `${CloudRunnerState.buildPathFull}/steam`;
  }
  public static get repoPathFull(): string {
    return `${CloudRunnerState.buildPathFull}/${CloudRunnerState.repositoryFolder}`;
  }
  public static get projectPathFull(): string {
    return `${CloudRunnerState.repoPathFull}/${CloudRunnerState.buildParams.projectPath}`;
  }
  public static get libraryFolderFull(): string {
    return `${CloudRunnerState.projectPathFull}/Library`;
  }
  public static get cacheFolderFull(): string {
    return `/${CloudRunnerState.buildVolumeFolder}/${CloudRunnerState.cacheFolder}/${CloudRunnerState.branchName}`;
  }
  public static get lfsDirectory(): string {
    return `${CloudRunnerState.repoPathFull}/.git/lfs`;
  }
  public static get purgeRemoteCaching(): boolean {
    return process.env.PURGE_REMOTE_BUILDER_CACHE !== undefined;
  }
  public static get unityBuilderRepoUrl(): string {
    return `https://${CloudRunnerState.buildParams.githubToken}@github.com/game-ci/unity-builder.git`;
  }
  public static get targetBuildRepoUrl(): string {
    return `https://${CloudRunnerState.buildParams.githubToken}@github.com/${process.env.GITHUB_REPOSITORY}.git`;
  }
  public static readonly defaultGitShaEnvironmentVariable = [
    {
      name: 'GITHUB_SHA',
      value: process.env.GITHUB_SHA || '',
    },
  ];
  public static readonly repositoryFolder = 'repo';
  public static readonly buildVolumeFolder = 'data';
  public static readonly cacheFolder = 'cache';
  public static cloudRunnerBranch: string;

  public static readBuildEnvironmentVariables(): CloudRunnerEnvironmentVariable[] {
    return [
      {
        name: 'ContainerMemory',
        value: CloudRunnerState.buildParams.cloudRunnerMemory,
      },
      {
        name: 'ContainerCpu',
        value: CloudRunnerState.buildParams.cloudRunnerCpu,
      },
      {
        name: 'GITHUB_WORKSPACE',
        value: `/${CloudRunnerState.buildVolumeFolder}/${CloudRunnerState.buildGuid}/${CloudRunnerState.repositoryFolder}/`,
      },
      {
        name: 'PROJECT_PATH',
        value: CloudRunnerState.buildParams.projectPath,
      },
      {
        name: 'BUILD_PATH',
        value: CloudRunnerState.buildParams.buildPath,
      },
      {
        name: 'BUILD_FILE',
        value: CloudRunnerState.buildParams.buildFile,
      },
      {
        name: 'BUILD_NAME',
        value: CloudRunnerState.buildParams.buildName,
      },
      {
        name: 'BUILD_METHOD',
        value: CloudRunnerState.buildParams.buildMethod,
      },
      {
        name: 'CUSTOM_PARAMETERS',
        value: CloudRunnerState.buildParams.customParameters,
      },
      {
        name: 'BUILD_TARGET',
        value: CloudRunnerState.buildParams.platform,
      },
      {
        name: 'ANDROID_VERSION_CODE',
        value: CloudRunnerState.buildParams.androidVersionCode.toString(),
      },
      {
        name: 'ANDROID_KEYSTORE_NAME',
        value: CloudRunnerState.buildParams.androidKeystoreName,
      },
      {
        name: 'ANDROID_KEYALIAS_NAME',
        value: CloudRunnerState.buildParams.androidKeyaliasName,
      },
      {
        name: 'SERIALIZED_BUILD_PARAMS',
        value: Buffer.from(JSON.stringify(CloudRunnerState.buildParams)).toString('base64'),
      },
    ];
  }

  public static get getHandleCachingCommand() {
    return `${CloudRunnerState.builderPathFull}/dist/cloud-runner/handleCaching.sh "${CloudRunnerState.cacheFolderFull}" "${CloudRunnerState.libraryFolderFull}" "${CloudRunnerState.lfsDirectory}" "${CloudRunnerState.purgeRemoteCaching}"`;
  }

  public static get cloneBuilderCommand() {
    const cloneCommand = `git clone -b ${CloudRunnerState.branchName} ${CloudRunnerState.unityBuilderRepoUrl} ${CloudRunnerState.builderPathFull}`;
    CloudRunnerLogger.log(cloneCommand);
    return cloneCommand;
  }

  public static get runNumber() {
    const runNumber = CloudRunnerState.buildParams.runNumber;
    if (!runNumber || runNumber === '') {
      throw new Error('no run number found, exiting');
    }
    return runNumber;
  }

  public static setupDefaultSecrets() {
    CloudRunnerState.defaultSecrets = [
      {
        ParameterKey: 'GithubToken',
        EnvironmentVariable: 'GITHUB_TOKEN',
        ParameterValue: CloudRunnerState.buildParams.githubToken,
      },
      {
        ParameterKey: 'branch',
        EnvironmentVariable: 'branch',
        ParameterValue: CloudRunnerState.branchName,
      },
      {
        ParameterKey: 'buildPathFull',
        EnvironmentVariable: 'buildPathFull',
        ParameterValue: CloudRunnerState.buildPathFull,
      },
      {
        ParameterKey: 'projectPathFull',
        EnvironmentVariable: 'projectPathFull',
        ParameterValue: CloudRunnerState.projectPathFull,
      },
      {
        ParameterKey: 'libraryFolderFull',
        EnvironmentVariable: 'libraryFolderFull',
        ParameterValue: CloudRunnerState.libraryFolderFull,
      },
      {
        ParameterKey: 'builderPathFull',
        EnvironmentVariable: 'builderPathFull',
        ParameterValue: CloudRunnerState.builderPathFull,
      },
      {
        ParameterKey: 'repoPathFull',
        EnvironmentVariable: 'repoPathFull',
        ParameterValue: CloudRunnerState.repoPathFull,
      },
      {
        ParameterKey: 'steamPathFull',
        EnvironmentVariable: 'steamPathFull',
        ParameterValue: CloudRunnerState.steamPathFull,
      },
    ];
    CloudRunnerState.defaultSecrets.push(
      ...ImageEnvironmentFactory.getEnvironmentVariables(CloudRunnerState.buildParams).map((x) => {
        return {
          ParameterKey: x.name,
          EnvironmentVariable: x.name,
          ParameterValue: x.value,
        };
      }),
    );
  }
}
