import path from 'path';
import { BuildParameters } from '../..';
import { CloudRunnerProviderInterface } from '../services/cloud-runner-provider-interface';
import CloudRunnerSecret from '../services/cloud-runner-secret';

export class CloudRunnerState {
  public static CloudRunnerProviderPlatform: CloudRunnerProviderInterface;
  public static buildParams: BuildParameters;
  public static defaultSecrets: CloudRunnerSecret[];
  public static readonly repositoryFolder = 'repo';

  // only the following paths that do not start a path.join with another "Full" suffixed property need to start with an absolute /

  public static get buildPathFull(): string {
    return path.join(`/`, CloudRunnerState.buildVolumeFolder, CloudRunnerState.buildParams.buildGuid);
  }

  public static get cacheFolderFull(): string {
    return path.join(
      '/',
      CloudRunnerState.buildVolumeFolder,
      CloudRunnerState.cacheFolder,
      CloudRunnerState.branchName,
    );
  }

  static setup(buildParameters: BuildParameters) {
    CloudRunnerState.buildParams = buildParameters;
  }

  public static get branchName(): string {
    return CloudRunnerState.buildParams.branch;
  }
  public static get builderPathFull(): string {
    return path.join(CloudRunnerState.buildPathFull, `builder`);
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

  public static get lfsDirectory(): string {
    return path.join(CloudRunnerState.repoPathFull, `.git`, `lfs`);
  }

  public static get purgeRemoteCaching(): boolean {
    return process.env.PURGE_REMOTE_BUILDER_CACHE !== undefined;
  }

  public static get lfsCacheFolderFull() {
    return path.join(CloudRunnerState.cacheFolderFull, `lfs`);
  }

  public static get libraryCacheFolderFull() {
    return path.join(CloudRunnerState.cacheFolderFull, `lib`);
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

  public static get buildVolumeFolder() {
    return 'data';
  }

  public static get cacheFolder() {
    return 'cache';
  }
}
