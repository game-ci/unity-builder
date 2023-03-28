import path from 'node:path';
import CloudRunnerOptions from './cloud-runner-options';
import CloudRunner from '../cloud-runner';
import BuildParameters from '../../build-parameters';

export class CloudRunnerFolders {
  public static readonly repositoryFolder = 'repo';

  public static ToLinuxFolder(folder: string) {
    return folder.replace(/\\/g, `/`);
  }

  // Only the following paths that do not start a path.join with another "Full" suffixed property need to start with an absolute /

  public static get uniqueCloudRunnerJobFolderAbsolute(): string {
    return CloudRunner.buildParameters && BuildParameters.shouldUseRetainedWorkspaceMode(CloudRunner.buildParameters)
      ? path.join(`/`, CloudRunnerFolders.buildVolumeFolder, CloudRunner.lockedWorkspace)
      : path.join(`/`, CloudRunnerFolders.buildVolumeFolder, CloudRunner.buildParameters.buildGuid);
  }

  public static get cacheFolderForAllFull(): string {
    return path.join('/', CloudRunnerFolders.buildVolumeFolder, CloudRunnerFolders.cacheFolder);
  }

  public static get cacheFolderForCacheKeyFull(): string {
    return path.join(
      '/',
      CloudRunnerFolders.buildVolumeFolder,
      CloudRunnerFolders.cacheFolder,
      CloudRunner.buildParameters.cacheKey,
    );
  }

  public static get builderPathAbsolute(): string {
    return path.join(
      CloudRunnerOptions.useSharedBuilder
        ? `/${CloudRunnerFolders.buildVolumeFolder}`
        : CloudRunnerFolders.uniqueCloudRunnerJobFolderAbsolute,
      `builder`,
    );
  }

  public static get repoPathAbsolute(): string {
    return path.join(CloudRunnerFolders.uniqueCloudRunnerJobFolderAbsolute, CloudRunnerFolders.repositoryFolder);
  }

  public static get projectPathAbsolute(): string {
    return path.join(CloudRunnerFolders.repoPathAbsolute, CloudRunner.buildParameters.projectPath);
  }

  public static get libraryFolderAbsolute(): string {
    return path.join(CloudRunnerFolders.projectPathAbsolute, `Library`);
  }

  public static get projectBuildFolderAbsolute(): string {
    return path.join(CloudRunnerFolders.repoPathAbsolute, CloudRunner.buildParameters.buildPath);
  }

  public static get lfsFolderAbsolute(): string {
    return path.join(CloudRunnerFolders.repoPathAbsolute, `.git`, `lfs`);
  }

  public static get purgeRemoteCaching(): boolean {
    return process.env.PURGE_REMOTE_BUILDER_CACHE !== undefined;
  }

  public static get lfsCacheFolderFull() {
    return path.join(CloudRunnerFolders.cacheFolderForCacheKeyFull, `lfs`);
  }

  public static get libraryCacheFolderFull() {
    return path.join(CloudRunnerFolders.cacheFolderForCacheKeyFull, `Library`);
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
