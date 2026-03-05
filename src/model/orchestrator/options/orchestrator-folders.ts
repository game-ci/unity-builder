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

  /**
   * Whether to use http.extraHeader for git authentication (secure, default)
   * instead of embedding the token in clone URLs (legacy).
   */
  public static get useHeaderAuth(): boolean {
    return Orchestrator.buildParameters.gitAuthMode !== 'url';
  }

  public static get unityBuilderRepoUrl(): string {
    if (OrchestratorFolders.useHeaderAuth) {
      return `https://github.com/${Orchestrator.buildParameters.orchestratorRepoName}.git`;
    }

    return `https://${Orchestrator.buildParameters.gitPrivateToken}@github.com/${Orchestrator.buildParameters.orchestratorRepoName}.git`;
  }

  public static get targetBuildRepoUrl(): string {
    if (OrchestratorFolders.useHeaderAuth) {
      return `https://github.com/${Orchestrator.buildParameters.githubRepo}.git`;
    }

    return `https://${Orchestrator.buildParameters.gitPrivateToken}@github.com/${Orchestrator.buildParameters.githubRepo}.git`;
  }

  /**
   * Shell commands to configure git authentication via http.extraHeader.
   * Uses GIT_PRIVATE_TOKEN env var so the token never appears in clone URLs or git config output.
   * This is the same mechanism used by actions/checkout.
   *
   * Only emits commands when gitAuthMode is 'header' (default). In 'url' mode,
   * returns a no-op comment since the token is already in the URL.
   */
  public static get gitAuthConfigScript(): string {
    if (!OrchestratorFolders.useHeaderAuth) {
      return `# git auth: using token-in-URL mode (legacy)`;
    }

    return `# git auth: configuring http.extraHeader (secure mode)
if [ -n "$GIT_PRIVATE_TOKEN" ]; then
  git config --global http.https://github.com/.extraHeader "Authorization: Basic $(printf '%s' "x-access-token:$GIT_PRIVATE_TOKEN" | base64 -w 0)"
fi`;
  }

  /**
   * Configure git authentication via http.extraHeader in the current Node process.
   * For use in the remote-client where shell scripts aren't used.
   * Only configures when gitAuthMode is 'header' (default).
   */
  public static async configureGitAuth(): Promise<void> {
    if (!OrchestratorFolders.useHeaderAuth) return;

    const token = Orchestrator.buildParameters.gitPrivateToken || process.env.GIT_PRIVATE_TOKEN || '';
    if (!token) return;

    const encoded = Buffer.from(`x-access-token:${token}`).toString('base64');
    const { OrchestratorSystem } = await import('../services/core/orchestrator-system');
    await OrchestratorSystem.Run(
      `git config --global http.https://github.com/.extraHeader "Authorization: Basic ${encoded}"`,
    );
  }

  public static get buildVolumeFolder() {
    return 'data';
  }

  public static get cacheFolder() {
    return 'cache';
  }
}
