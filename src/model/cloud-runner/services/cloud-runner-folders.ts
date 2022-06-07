import * as path from 'https://deno.land/std@0.141.0/path/mod.ts';
import { CloudRunner } from '../...ts';

export class CloudRunnerFolders {
  public static readonly repositoryFolder = 'repo';

  // Only the following paths that do not start a path.join with another "Full" suffixed property need to start with an absolute /

  public static get uniqueCloudRunnerJobFolderAbsolute(): string {
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

  public static get builderPathAbsolute(): string {
    return path.join(CloudRunnerFolders.uniqueCloudRunnerJobFolderAbsolute, `builder`);
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
