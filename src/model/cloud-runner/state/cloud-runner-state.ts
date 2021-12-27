import path from 'path';
import { BuildParameters } from '../..';
import CloudRunnerEnvironmentVariable from '../services/cloud-runner-environment-variable';
import CloudRunnerNamespace from '../services/cloud-runner-namespace';
import { CloudRunnerProviderInterface } from '../services/cloud-runner-provider-interface';
import CloudRunnerSecret from '../services/cloud-runner-secret';
import { TaskParameterSerializer } from './task-parameter-serializer';

export class CloudRunnerState {
  static setup(buildParameters: BuildParameters) {
    CloudRunnerState.buildParams = buildParameters;
    if (CloudRunnerState.buildGuid === undefined) {
      CloudRunnerState.buildGuid = CloudRunnerNamespace.generateBuildName(
        CloudRunnerState.runNumber,
        buildParameters.platform,
      );
    }
    TaskParameterSerializer.setupDefaultSecrets();
  }
  public static CloudRunnerProviderPlatform: CloudRunnerProviderInterface;
  public static buildParams: BuildParameters;
  public static defaultSecrets: CloudRunnerSecret[];
  public static buildGuid: string;
  public static get branchName(): string {
    return CloudRunnerState.buildParams.branch;
  }
  public static get buildPathFull(): string {
    return path.join(`/`, CloudRunnerState.buildVolumeFolder, CloudRunnerState.buildGuid);
  }
  public static get builderPathFull(): string {
    return path.join(CloudRunnerState.buildPathFull, `builder`);
  }
  public static get steamPathFull(): string {
    return path.join(CloudRunnerState.buildPathFull, `steam`);
  }
  public static get repoPathFull(): string {
    return path.join(CloudRunnerState.buildPathFull, CloudRunnerState.repositoryFolder);
  }
  public static get projectPathFull(): string {
    return path.join(CloudRunnerState.repoPathFull, CloudRunnerState.buildParams.projectPath);
  }
  public static get libraryFolderFull(): string {
    return path.join(CloudRunnerState.projectPathFull, `Library`);
  }
  public static get cacheFolderFull(): string {
    return path.join(CloudRunnerState.buildVolumeFolder, CloudRunnerState.cacheFolder, CloudRunnerState.branchName);
  }
  public static get lfsDirectory(): string {
    return path.join(CloudRunnerState.repoPathFull, `.git`, `lfs`);
  }
  public static get purgeRemoteCaching(): boolean {
    return process.env.PURGE_REMOTE_BUILDER_CACHE !== undefined;
  }
  public static get unityBuilderRepoUrl(): string {
    return `https://${CloudRunnerState.buildParams.githubToken}@github.com/game-ci/unity-builder.git`;
  }
  public static get targetBuildRepoUrl(): string {
    return `https://${CloudRunnerState.buildParams.githubToken}@github.com/${CloudRunnerState.githubRepo}.git`;
  }

  public static get githubRepo(): string {
    return `${CloudRunnerState.buildParams.githubRepo}`;
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
    return TaskParameterSerializer.readBuildEnvironmentVariables();
  }

  public static get runNumber() {
    const runNumber = CloudRunnerState.buildParams.runNumber;
    if (!runNumber || runNumber === '') {
      throw new Error('no run number found, exiting');
    }
    return runNumber;
  }
}
