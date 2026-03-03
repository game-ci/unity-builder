import path from 'node:path';
import OrchestratorOptions from './orchestrator-options';
import Orchestrator from '../orchestrator';
import BuildParameters from '../../build-parameters';

export class OrchestratorFolders {
  public static readonly repositoryFolder = 'repo';

  public static ToLinuxFolder(folder: string) {
    return folder.replace(/\\/g, `/`);
  }

  // Only the following paths that do not start a path.join with another "Full" suffixed property need to start with an absolute /

  public static get uniqueOrchestratorJobFolderAbsolute(): string {
    return Orchestrator.buildParameters && BuildParameters.shouldUseRetainedWorkspaceMode(Orchestrator.buildParameters)
      ? path.join(`/`, OrchestratorFolders.buildVolumeFolder, Orchestrator.lockedWorkspace)
      : path.join(`/`, OrchestratorFolders.buildVolumeFolder, Orchestrator.buildParameters.buildGuid);
  }

  public static get cacheFolderForAllFull(): string {
    return path.join('/', OrchestratorFolders.buildVolumeFolder, OrchestratorFolders.cacheFolder);
  }

  public static get cacheFolderForCacheKeyFull(): string {
    return path.join(
      '/',
      OrchestratorFolders.buildVolumeFolder,
      OrchestratorFolders.cacheFolder,
      Orchestrator.buildParameters.cacheKey,
    );
  }

  public static get builderPathAbsolute(): string {
    return path.join(
      OrchestratorOptions.useSharedBuilder
        ? `/${OrchestratorFolders.buildVolumeFolder}`
        : OrchestratorFolders.uniqueOrchestratorJobFolderAbsolute,
      `builder`,
    );
  }

  public static get repoPathAbsolute(): string {
    return path.join(OrchestratorFolders.uniqueOrchestratorJobFolderAbsolute, OrchestratorFolders.repositoryFolder);
  }

  public static get projectPathAbsolute(): string {
    return path.join(OrchestratorFolders.repoPathAbsolute, Orchestrator.buildParameters.projectPath);
  }

  public static get libraryFolderAbsolute(): string {
    return path.join(OrchestratorFolders.projectPathAbsolute, `Library`);
  }

  public static get projectBuildFolderAbsolute(): string {
    return path.join(OrchestratorFolders.repoPathAbsolute, Orchestrator.buildParameters.buildPath);
  }

  public static get lfsFolderAbsolute(): string {
    return path.join(OrchestratorFolders.repoPathAbsolute, `.git`, `lfs`);
  }

  public static get purgeRemoteCaching(): boolean {
    return process.env.PURGE_REMOTE_BUILDER_CACHE !== undefined;
  }

  public static get lfsCacheFolderFull() {
    return path.join(OrchestratorFolders.cacheFolderForCacheKeyFull, `lfs`);
  }

  public static get libraryCacheFolderFull() {
    return path.join(OrchestratorFolders.cacheFolderForCacheKeyFull, `Library`);
  }

  public static get unityBuilderRepoUrl(): string {
    return `https://${Orchestrator.buildParameters.gitPrivateToken}@github.com/${Orchestrator.buildParameters.orchestratorRepoName}.git`;
  }

  public static get targetBuildRepoUrl(): string {
    return `https://${Orchestrator.buildParameters.gitPrivateToken}@github.com/${Orchestrator.buildParameters.githubRepo}.git`;
  }

  public static get buildVolumeFolder() {
    return 'data';
  }

  public static get cacheFolder() {
    return 'cache';
  }
}
