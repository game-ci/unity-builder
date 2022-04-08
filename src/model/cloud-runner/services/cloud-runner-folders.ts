import path from 'path';
import { CloudRunner } from '../..';

export class CloudRunnerFolders {
  public static readonly repositoryFolder = 'repo';

  // only the following paths that do not start a path.join with another "Full" suffixed property need to start with an absolute /

  public static get uniqueCloudRunnerJobFolderFull(): string {
    return path.join(`/`, CloudRunnerFolders.buildVolumeFolder, CloudRunner.buildParameters.buildGuid);
  }

  public static get cacheFolderFull(): string {
    return path.join(
      '/',
      CloudRunnerFolders.buildVolumeFolder,
      CloudRunnerFolders.cacheFolder,
      CloudRunner.buildParameters.cacheKey,
    );
  }

  public static get builderPathFull(): string {
    return path.join(CloudRunnerFolders.uniqueCloudRunnerJobFolderFull, `builder`);
  }

  public static get repoPathFull(): string {
    return path.join(CloudRunnerFolders.uniqueCloudRunnerJobFolderFull, CloudRunnerFolders.repositoryFolder);
  }

  public static get projectPathFull(): string {
    return path.join(CloudRunnerFolders.repoPathFull, CloudRunner.buildParameters.projectPath);
  }

  public static get libraryFolderFull(): string {
    return path.join(CloudRunnerFolders.projectPathFull, `Library`);
  }

  public static get projectBuildFolderFull(): string {
    return path.join(CloudRunnerFolders.projectPathFull, `build`);
  }

  public static get lfsDirectoryFull(): string {
    return path.join(CloudRunnerFolders.repoPathFull, `.git`, `lfs`);
  }

  public static get purgeRemoteCaching(): boolean {
    return process.env.PURGE_REMOTE_BUILDER_CACHE !== undefined;
  }

  public static get lfsCacheFolderFull() {
    return path.join(CloudRunnerFolders.cacheFolderFull, `lfs`);
  }

  public static get libraryCacheFolderFull() {
    return path.join(CloudRunnerFolders.cacheFolderFull, `Library`);
  }

  public static get unityBuilderRepoUrl(): string {
    return `https://${CloudRunner.buildParameters.gitPrivateToken}@github.com/game-ci/unity-builder.git`;
  }

  public static get targetBuildRepoUrl(): string {
    return `https://${CloudRunner.buildParameters.gitPrivateToken}@github.com/${CloudRunner.buildParameters.githubRepo}.git`;
  }

  public static get buildVolumeFolder() {
    return 'data';
  }

  public static get cacheFolder() {
    return 'cache';
  }
}
