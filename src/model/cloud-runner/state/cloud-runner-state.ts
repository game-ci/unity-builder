import { BuildParameters } from '../..';
import ImageEnvironmentFactory from '../../image-environment-factory';
import CloudRunnerEnvironmentVariable from '../services/cloud-runner-environment-variable';
import { CloudRunnerProviderInterface } from '../services/cloud-runner-provider-interface';
import CloudRunnerSecret from '../services/cloud-runner-secret';

export class CloudRunnerState {
  public static CloudRunnerProviderPlatform: CloudRunnerProviderInterface;
  public static buildParams: BuildParameters;
  public static defaultSecrets: CloudRunnerSecret[];
  public static buildGuid: string;
  public static branchName: string;
  public static buildPathFull: string;
  public static builderPathFull: string;
  public static steamPathFull: string;
  public static repoPathFull: string;
  public static projectPathFull: string;
  public static libraryFolderFull: string;
  public static cacheFolderFull: string;
  public static lfsDirectory: string;
  public static purgeRemoteCaching: boolean;
  public static CloudRunnerBranch: string;
  public static unityBuilderRepoUrl: string;
  public static targetBuildRepoUrl: string;
  public static readonly defaultGitShaEnvironmentVariable = [
    {
      name: 'GITHUB_SHA',
      value: process.env.GITHUB_SHA || '',
    },
  ];
  public static readonly repositoryFolder = 'repo';
  public static readonly buildVolumeFolder = 'data';
  public static readonly cacheFolder = 'cache';

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
    ];
  }

  public static getHandleCachingCommand() {
    return `${CloudRunnerState.builderPathFull}/dist/cloud-runner/handleCaching.sh "${CloudRunnerState.cacheFolderFull}" "${CloudRunnerState.libraryFolderFull}" "${CloudRunnerState.lfsDirectory}" "${CloudRunnerState.purgeRemoteCaching}"`;
  }

  public static getCloneNoLFSCommand() {
    return `${CloudRunnerState.builderPathFull}/dist/cloud-runner/cloneNoLFS.sh "${CloudRunnerState.repoPathFull}" "${CloudRunnerState.targetBuildRepoUrl}"`;
  }

  public static getCloneBuilder() {
    return `git clone -q ${CloudRunnerState.CloudRunnerBranch} ${CloudRunnerState.unityBuilderRepoUrl} ${CloudRunnerState.builderPathFull}`;
  }

  public static readRunNumber() {
    const runNumber = process.env.GITHUB_RUN_NUMBER;
    if (!runNumber || runNumber === '') {
      throw new Error('no run number found, exiting');
    }
    return runNumber;
  }

  public static setupFolderVariables() {
    CloudRunnerState.buildPathFull = `/${CloudRunnerState.buildVolumeFolder}/${CloudRunnerState.buildGuid}`;
    CloudRunnerState.builderPathFull = `${CloudRunnerState.buildPathFull}/builder`;
    CloudRunnerState.steamPathFull = `${CloudRunnerState.buildPathFull}/steam`;
    CloudRunnerState.repoPathFull = `${CloudRunnerState.buildPathFull}/${CloudRunnerState.repositoryFolder}`;
    CloudRunnerState.projectPathFull = `${CloudRunnerState.repoPathFull}/${CloudRunnerState.buildParams.projectPath}`;
    CloudRunnerState.libraryFolderFull = `${CloudRunnerState.projectPathFull}/Library`;
    CloudRunnerState.cacheFolderFull = `/${CloudRunnerState.buildVolumeFolder}/${CloudRunnerState.cacheFolder}/${CloudRunnerState.branchName}`;
    CloudRunnerState.lfsDirectory = `${CloudRunnerState.repoPathFull}/.git/lfs`;
    CloudRunnerState.purgeRemoteCaching = process.env.PURGE_REMOTE_BUILDER_CACHE !== undefined;
    CloudRunnerState.CloudRunnerBranch = process.env.CloudRunnerBranch
      ? `--branch "${process.env.CloudRunnerBranch}"`
      : '';
    CloudRunnerState.unityBuilderRepoUrl = `https://${CloudRunnerState.buildParams.githubToken}@github.com/game-ci/unity-builder.git`;
    CloudRunnerState.targetBuildRepoUrl = `https://${CloudRunnerState.buildParams.githubToken}@github.com/${process.env.GITHUB_REPOSITORY}.git`;
  }

  public static setupBranchName() {
    const defaultBranchName =
      process.env.GITHUB_REF?.split('/')
        .filter((x) => {
          x = x[0].toUpperCase() + x.slice(1);
          return x;
        })
        .join('') || '';
    CloudRunnerState.branchName =
      process.env.REMOTE_BUILDER_CACHE !== undefined ? process.env.REMOTE_BUILDER_CACHE : defaultBranchName;
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
