import fs from 'node:fs';
import Orchestrator from '../orchestrator';
import { OrchestratorFolders } from '../options/orchestrator-folders';
import { Caching } from './caching';
import { LfsHashing } from '../services/utility/lfs-hashing';
import { RemoteClientLogger } from './remote-client-logger';
import path from 'node:path';
import { assert } from 'node:console';
import OrchestratorLogger from '../services/core/orchestrator-logger';
import { CliFunction } from '../../cli/cli-functions-repository';
import { OrchestratorSystem } from '../services/core/orchestrator-system';
import YAML from 'yaml';
import GitHub from '../../github';
import BuildParameters from '../../build-parameters';
import { Cli } from '../../cli/cli';
import OrchestratorOptions from '../options/orchestrator-options';
import ResourceTracking from '../services/core/resource-tracking';
import { IncrementalSyncService } from '../services/sync';
import { SyncStrategy } from '../services/sync/sync-state';

export class RemoteClient {
  @CliFunction(`remote-cli-pre-build`, `sets up a repository, usually before a game-ci build`)
  static async setupRemoteClient() {
    OrchestratorLogger.log(`bootstrap game ci orchestrator...`);
    await ResourceTracking.logDiskUsageSnapshot('remote-cli-pre-build (start)');

    const syncStrategy = (Orchestrator.buildParameters.syncStrategy || 'full') as SyncStrategy;

    if (syncStrategy !== 'full') {
      OrchestratorLogger.log(`[Sync] Using incremental sync strategy: ${syncStrategy}`);
      await RemoteClient.handleIncrementalSync(syncStrategy);
    } else if (!(await RemoteClient.handleRetainedWorkspace())) {
      await RemoteClient.bootstrapRepository();
    }

    await RemoteClient.replaceLargePackageReferencesWithSharedReferences();
    await RemoteClient.runCustomHookFiles(`before-build`);
  }

  @CliFunction('remote-cli-log-stream', `log stream from standard input`)
  public static async remoteClientLogStream() {
    const logFile = Cli.options!['logFile'];
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    // For K8s, ensure stdout is unbuffered so messages are captured immediately
    if (OrchestratorOptions.providerStrategy === 'k8s') {
      process.stdout.setDefaultEncoding('utf8');
    }

    let lingeringLine = '';

    process.stdin.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');

      lines[0] = lingeringLine + lines[0];
      lingeringLine = lines.pop() || '';

      for (const element of lines) {
        // Always write to log file so output can be collected by providers
        if (element.trim()) {
          fs.appendFileSync(logFile, `${element}\n`);
        }

        // For K8s, also write to stdout so kubectl logs can capture it
        if (OrchestratorOptions.providerStrategy === 'k8s') {
          // Write to stdout so kubectl logs can capture it - ensure newline is included
          // Stdout flushes automatically on newline, so no explicit flush needed
          process.stdout.write(`${element}\n`);
        }

        OrchestratorLogger.log(element);
      }
    });

    process.stdin.on('end', () => {
      if (lingeringLine) {
        // Always write to log file so output can be collected by providers
        fs.appendFileSync(logFile, `${lingeringLine}\n`);

        // For K8s, also write to stdout so kubectl logs can capture it
        if (OrchestratorOptions.providerStrategy === 'k8s') {
          // Stdout flushes automatically on newline
          process.stdout.write(`${lingeringLine}\n`);
        }
      }

      OrchestratorLogger.log(lingeringLine);
    });
  }

  @CliFunction(`remote-cli-post-build`, `runs a orchestrator build`)
  public static async remoteClientPostBuild(): Promise<string> {
    try {
      RemoteClientLogger.log(`Running POST build tasks`);

      // Ensure cache key is present in logs for assertions
      RemoteClientLogger.log(`CACHE_KEY=${Orchestrator.buildParameters.cacheKey}`);
      OrchestratorLogger.log(`${Orchestrator.buildParameters.cacheKey}`);

      // Guard: only push Library cache if the folder exists and has contents
      try {
        const libraryFolderHost = OrchestratorFolders.libraryFolderAbsolute;
        if (fs.existsSync(libraryFolderHost)) {
          let libraryEntries: string[] = [];
          try {
            libraryEntries = await fs.promises.readdir(libraryFolderHost);
          } catch {
            libraryEntries = [];
          }
          if (libraryEntries.length > 0) {
            await Caching.PushToCache(
              OrchestratorFolders.ToLinuxFolder(`${OrchestratorFolders.cacheFolderForCacheKeyFull}/Library`),
              OrchestratorFolders.ToLinuxFolder(OrchestratorFolders.libraryFolderAbsolute),
              `lib-${Orchestrator.buildParameters.buildGuid}`,
            );
          } else {
            RemoteClientLogger.log(`Skipping Library cache push (folder is empty)`);
          }
        } else {
          RemoteClientLogger.log(`Skipping Library cache push (folder missing)`);
        }
      } catch (error: any) {
        RemoteClientLogger.logWarning(`Library cache push skipped with error: ${error.message}`);
      }

      // Guard: only push Build cache if the folder exists and has contents
      try {
        const buildFolderHost = OrchestratorFolders.projectBuildFolderAbsolute;
        if (fs.existsSync(buildFolderHost)) {
          let buildEntries: string[] = [];
          try {
            buildEntries = await fs.promises.readdir(buildFolderHost);
          } catch {
            buildEntries = [];
          }
          if (buildEntries.length > 0) {
            await Caching.PushToCache(
              OrchestratorFolders.ToLinuxFolder(`${OrchestratorFolders.cacheFolderForCacheKeyFull}/build`),
              OrchestratorFolders.ToLinuxFolder(OrchestratorFolders.projectBuildFolderAbsolute),
              `build-${Orchestrator.buildParameters.buildGuid}`,
            );
          } else {
            RemoteClientLogger.log(`Skipping Build cache push (folder is empty)`);
          }
        } else {
          RemoteClientLogger.log(`Skipping Build cache push (folder missing)`);
        }
      } catch (error: any) {
        RemoteClientLogger.logWarning(`Build cache push skipped with error: ${error.message}`);
      }

      if (!BuildParameters.shouldUseRetainedWorkspaceMode(Orchestrator.buildParameters)) {
        const uniqueJobFolderLinux = OrchestratorFolders.ToLinuxFolder(
          OrchestratorFolders.uniqueOrchestratorJobFolderAbsolute,
        );
        if (
          fs.existsSync(OrchestratorFolders.uniqueOrchestratorJobFolderAbsolute) ||
          fs.existsSync(uniqueJobFolderLinux)
        ) {
          await OrchestratorSystem.Run(`rm -r ${uniqueJobFolderLinux} || true`);
        } else {
          RemoteClientLogger.log(`Skipping cleanup; unique job folder missing`);
        }
      }

      await RemoteClient.runCustomHookFiles(`after-build`);

      // Revert sync overlays if configured
      const syncStrategy = (Orchestrator.buildParameters.syncStrategy || 'full') as SyncStrategy;
      if (Orchestrator.buildParameters.syncRevertAfter && syncStrategy !== 'full') {
        try {
          OrchestratorLogger.log('[Sync] Reverting overlay changes after job completion');
          await IncrementalSyncService.revertOverlays(
            OrchestratorFolders.repoPathAbsolute,
            Orchestrator.buildParameters.syncStatePath,
          );
        } catch (revertError: any) {
          RemoteClientLogger.logWarning(`[Sync] Overlay revert failed: ${revertError.message}`);
        }
      }

      // WIP - need to give the pod permissions to create config map
      await RemoteClientLogger.handleLogManagementPostJob();
    } catch (error: any) {
      // Log error but don't fail - post-build tasks are best-effort
      RemoteClientLogger.logWarning(`Post-build task error: ${error.message}`);
      OrchestratorLogger.log(`Post-build task error: ${error.message}`);
    }

    // Ensure success marker is always present in logs for tests, even if post-build tasks failed
    // For K8s, kubectl logs reads from stdout/stderr, so we must write to stdout
    // For all providers, we write to stdout so it gets piped through the log stream
    // The log stream will capture it and add it to BuildResults
    const successMessage = `Activation successful`;

    // Write directly to log file first to ensure it's captured even if pipe fails
    // This is critical for all providers, especially K8s where timing matters
    try {
      const logFilePath = Orchestrator.isOrchestratorEnvironment
        ? `/home/job-log.txt`
        : path.join(process.cwd(), 'temp', 'job-log.txt');
      if (fs.existsSync(path.dirname(logFilePath))) {
        fs.appendFileSync(logFilePath, `${successMessage}\n`);
      }
    } catch {
      // If direct file write fails, continue with other methods
    }

    // Write to stdout so it gets piped through remote-cli-log-stream when invoked via pipe
    // This ensures the message is captured in BuildResults for all providers
    // Use synchronous write and ensure newline is included for proper flushing
    process.stdout.write(`${successMessage}\n`, 'utf8');

    // For K8s, also write to stderr as a backup since kubectl logs reads from both stdout and stderr
    // This ensures the message is captured even if stdout pipe has issues
    if (OrchestratorOptions.providerStrategy === 'k8s') {
      process.stderr.write(`${successMessage}\n`, 'utf8');
    }

    // Ensure stdout is flushed before process exits (critical for K8s where process might exit quickly)
    // For non-TTY streams, we need to explicitly ensure the write completes
    if (!process.stdout.isTTY) {
      // Give the pipe a moment to process the write
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Also log via OrchestratorLogger and RemoteClientLogger for GitHub Actions and log file
    // This ensures the message appears in log files for providers that read from log files
    // RemoteClientLogger.log writes directly to the log file, which is important for providers
    // that read from the log file rather than stdout
    RemoteClientLogger.log(successMessage);
    OrchestratorLogger.log(successMessage);
    await ResourceTracking.logDiskUsageSnapshot('remote-cli-post-build (end)');

    return new Promise((result) => result(``));
  }
  static async runCustomHookFiles(hookLifecycle: string) {
    RemoteClientLogger.log(`RunCustomHookFiles: ${hookLifecycle}`);
    const gameCiCustomHooksPath = path.join(OrchestratorFolders.repoPathAbsolute, `game-ci`, `hooks`);
    try {
      const files = fs.readdirSync(gameCiCustomHooksPath);
      for (const file of files) {
        const fileContents = fs.readFileSync(path.join(gameCiCustomHooksPath, file), `utf8`);
        const fileContentsObject = YAML.parse(fileContents.toString());
        if (fileContentsObject.hook === hookLifecycle) {
          RemoteClientLogger.log(`Active Hook File ${file} \n \n file contents: \n ${fileContents}`);
          await OrchestratorSystem.Run(fileContentsObject.commands);
        }
      }
    } catch (error) {
      RemoteClientLogger.log(JSON.stringify(error, undefined, 4));
    }
  }

  /**
   * Handle incremental sync strategies (git-delta, direct-input, storage-pull).
   *
   * For git-delta: requires an existing workspace with sync state; fetches and applies
   * only changed files.
   *
   * For direct-input and storage-pull: requires an existing workspace; applies overlay
   * content on top.
   *
   * Falls back to full bootstrapRepository() if incremental sync cannot proceed.
   */
  private static async handleIncrementalSync(strategy: SyncStrategy): Promise<void> {
    const buildParameters = Orchestrator.buildParameters;
    const workspacePath = OrchestratorFolders.repoPathAbsolute;
    const statePath = buildParameters.syncStatePath;

    // Resolve strategy — may fall back to 'full' if no state exists
    const resolvedStrategy = IncrementalSyncService.resolveStrategy(strategy, workspacePath, statePath);

    if (resolvedStrategy === 'full') {
      OrchestratorLogger.log('[Sync] Falling back to full bootstrap');
      if (!(await RemoteClient.handleRetainedWorkspace())) {
        await RemoteClient.bootstrapRepository();
      }

      return;
    }

    switch (resolvedStrategy) {
      case 'git-delta': {
        const targetReference = buildParameters.gitSha || buildParameters.branch;
        OrchestratorLogger.log(`[Sync] Git delta sync to ${targetReference}`);
        const changedFiles = await IncrementalSyncService.syncGitDelta(workspacePath, targetReference, statePath);
        OrchestratorLogger.log(`[Sync] Git delta complete: ${changedFiles} file(s) updated`);
        break;
      }
      case 'direct-input': {
        const inputReference = buildParameters.syncInputRef;
        if (!inputReference) {
          throw new Error('[Sync] direct-input strategy requires syncInputRef');
        }
        OrchestratorLogger.log(`[Sync] Applying direct input: ${inputReference}`);
        await IncrementalSyncService.applyDirectInput(
          workspacePath,
          inputReference,
          buildParameters.syncStorageRemote || undefined,
          statePath,
        );
        break;
      }
      case 'storage-pull': {
        const storageUri = buildParameters.syncInputRef;
        if (!storageUri) {
          throw new Error('[Sync] storage-pull strategy requires syncInputRef');
        }
        OrchestratorLogger.log(`[Sync] Storage pull from: ${storageUri}`);
        await IncrementalSyncService.syncStoragePull(workspacePath, storageUri, {
          rcloneRemote: buildParameters.syncStorageRemote || undefined,
          syncRevertAfter: buildParameters.syncRevertAfter,
          statePath,
        });
        break;
      }
      default:
        OrchestratorLogger.logWarning(`[Sync] Unknown strategy: ${resolvedStrategy}, falling back to full`);
        if (!(await RemoteClient.handleRetainedWorkspace())) {
          await RemoteClient.bootstrapRepository();
        }
    }
  }

  public static async bootstrapRepository() {
    await OrchestratorSystem.Run(
      `mkdir -p ${OrchestratorFolders.ToLinuxFolder(OrchestratorFolders.uniqueOrchestratorJobFolderAbsolute)}`,
    );
    await OrchestratorSystem.Run(
      `mkdir -p ${OrchestratorFolders.ToLinuxFolder(OrchestratorFolders.cacheFolderForCacheKeyFull)}`,
    );
    await RemoteClient.cloneRepoWithoutLFSFiles();
    await RemoteClient.sizeOfFolder(
      'repo before lfs cache pull',
      OrchestratorFolders.ToLinuxFolder(OrchestratorFolders.repoPathAbsolute),
    );
    const lfsHashes = await LfsHashing.createLFSHashFiles();
    if (fs.existsSync(OrchestratorFolders.libraryFolderAbsolute)) {
      RemoteClientLogger.logWarning(`!Warning!: The Unity library was included in the git repository`);
    }
    await Caching.PullFromCache(
      OrchestratorFolders.ToLinuxFolder(OrchestratorFolders.lfsCacheFolderFull),
      OrchestratorFolders.ToLinuxFolder(OrchestratorFolders.lfsFolderAbsolute),
      `${lfsHashes.lfsGuidSum}`,
    );
    await RemoteClient.sizeOfFolder('repo after lfs cache pull', OrchestratorFolders.repoPathAbsolute);
    await RemoteClient.pullLatestLFS();
    await RemoteClient.sizeOfFolder('repo before lfs git pull', OrchestratorFolders.repoPathAbsolute);
    await Caching.PushToCache(
      OrchestratorFolders.ToLinuxFolder(OrchestratorFolders.lfsCacheFolderFull),
      OrchestratorFolders.ToLinuxFolder(OrchestratorFolders.lfsFolderAbsolute),
      `${lfsHashes.lfsGuidSum}`,
    );
    await Caching.PullFromCache(
      OrchestratorFolders.ToLinuxFolder(OrchestratorFolders.libraryCacheFolderFull),
      OrchestratorFolders.ToLinuxFolder(OrchestratorFolders.libraryFolderAbsolute),
    );
    await RemoteClient.sizeOfFolder('repo after library cache pull', OrchestratorFolders.repoPathAbsolute);
    await Caching.handleCachePurging();
  }

  private static async sizeOfFolder(message: string, folder: string) {
    if (Orchestrator.buildParameters.orchestratorDebug) {
      OrchestratorLogger.log(`Size of ${message}`);
      await OrchestratorSystem.Run(`du -sh ${folder}`);
    }
  }

  private static async cloneRepoWithoutLFSFiles() {
    process.chdir(`${OrchestratorFolders.uniqueOrchestratorJobFolderAbsolute}`);
    if (
      fs.existsSync(OrchestratorFolders.repoPathAbsolute) &&
      !fs.existsSync(path.join(OrchestratorFolders.repoPathAbsolute, `.git`))
    ) {
      await OrchestratorSystem.Run(`rm -r ${OrchestratorFolders.repoPathAbsolute}`);
      OrchestratorLogger.log(`${OrchestratorFolders.repoPathAbsolute} repo exists, but no git folder, cleaning up`);
    }

    if (
      BuildParameters.shouldUseRetainedWorkspaceMode(Orchestrator.buildParameters) &&
      fs.existsSync(path.join(OrchestratorFolders.repoPathAbsolute, `.git`))
    ) {
      process.chdir(OrchestratorFolders.repoPathAbsolute);
      RemoteClientLogger.log(
        `${
          OrchestratorFolders.repoPathAbsolute
        } repo exists - skipping clone - retained workspace mode ${BuildParameters.shouldUseRetainedWorkspaceMode(
          Orchestrator.buildParameters,
        )}`,
      );
      await OrchestratorSystem.Run(`git fetch && git reset --hard ${Orchestrator.buildParameters.gitSha}`);

      return;
    }

    RemoteClientLogger.log(`Initializing source repository for cloning with caching of LFS files`);
    await OrchestratorSystem.Run(`git config --global advice.detachedHead false`);
    RemoteClientLogger.log(`Cloning the repository being built:`);
    await OrchestratorSystem.Run(`git config --global filter.lfs.smudge "git-lfs smudge --skip -- %f"`);
    await OrchestratorSystem.Run(`git config --global filter.lfs.process "git-lfs filter-process --skip"`);
    try {
      const depthArgument = OrchestratorOptions.cloneDepth !== '0' ? `--depth ${OrchestratorOptions.cloneDepth}` : '';
      await OrchestratorSystem.Run(
        `git clone ${depthArgument} ${OrchestratorFolders.targetBuildRepoUrl} ${path.basename(
          OrchestratorFolders.repoPathAbsolute,
        )}`.trim(),
      );
    } catch (error: any) {
      throw error;
    }
    process.chdir(OrchestratorFolders.repoPathAbsolute);
    await OrchestratorSystem.Run(`git lfs install`);
    assert(fs.existsSync(`.git`), 'git folder exists');
    RemoteClientLogger.log(`${Orchestrator.buildParameters.branch}`);

    // Ensure refs exist (tags and PR refs)
    await OrchestratorSystem.Run(`git fetch --all --tags || true`);
    const branchForPrFetch = Orchestrator.buildParameters.branch || '';
    if (branchForPrFetch.startsWith('pull/')) {
      // Extract PR number and fetch only that specific ref (e.g., pull/731/merge -> 731)
      const prNumber = branchForPrFetch.split('/')[1];
      if (prNumber) {
        await OrchestratorSystem.Run(
          `git fetch origin +refs/pull/${prNumber}/merge:refs/remotes/origin/pull/${prNumber}/merge +refs/pull/${prNumber}/head:refs/remotes/origin/pull/${prNumber}/head || true`,
        );
      }
    }
    const targetSha = Orchestrator.buildParameters.gitSha;
    const targetBranch = Orchestrator.buildParameters.branch;
    if (targetSha) {
      try {
        await OrchestratorSystem.Run(`git checkout ${targetSha}`);
      } catch {
        try {
          await OrchestratorSystem.Run(`git fetch origin ${targetSha} || true`);
          await OrchestratorSystem.Run(`git checkout ${targetSha}`);
        } catch (error) {
          RemoteClientLogger.logWarning(`Falling back to branch checkout; SHA not found: ${targetSha}`);
          try {
            await OrchestratorSystem.Run(`git checkout ${targetBranch}`);
          } catch {
            if ((targetBranch || '').startsWith('pull/')) {
              await OrchestratorSystem.Run(`git checkout origin/${targetBranch}`);
            } else {
              throw error;
            }
          }
        }
      }
    } else {
      try {
        await OrchestratorSystem.Run(`git checkout ${targetBranch}`);
      } catch (_error) {
        if ((targetBranch || '').startsWith('pull/')) {
          await OrchestratorSystem.Run(`git checkout origin/${targetBranch}`);
        } else {
          throw _error;
        }
      }
      RemoteClientLogger.log(`buildParameter Git Sha is empty`);
    }

    assert(fs.existsSync(path.join(`.git`, `lfs`)), 'LFS folder should not exist before caching');
    RemoteClientLogger.log(`Checked out ${Orchestrator.buildParameters.branch}`);
  }

  static async replaceLargePackageReferencesWithSharedReferences() {
    OrchestratorLogger.log(`Use Shared Pkgs ${Orchestrator.buildParameters.useLargePackages}`);
    GitHub.updateGitHubCheck(`Use Shared Pkgs ${Orchestrator.buildParameters.useLargePackages}`, ``);
    if (Orchestrator.buildParameters.useLargePackages) {
      const filePath = path.join(OrchestratorFolders.projectPathAbsolute, `Packages/manifest.json`);
      let manifest = fs.readFileSync(filePath, 'utf8');
      manifest = manifest.replace(/LargeContent/g, '../../../LargeContent');
      fs.writeFileSync(filePath, manifest);
      OrchestratorLogger.log(`Package Manifest \n ${manifest}`);
      GitHub.updateGitHubCheck(`Package Manifest \n ${manifest}`, ``);
    }
  }

  private static async pullLatestLFS() {
    process.chdir(OrchestratorFolders.repoPathAbsolute);
    await OrchestratorSystem.Run(`git config --global filter.lfs.smudge "git-lfs smudge -- %f"`);
    await OrchestratorSystem.Run(`git config --global filter.lfs.process "git-lfs filter-process"`);
    if (Orchestrator.buildParameters.skipLfs) {
      RemoteClientLogger.log(`Skipping LFS pull (skipLfs=true)`);

      return;
    }

    // Best effort: try plain pull first (works for public repos or pre-configured auth)
    try {
      await OrchestratorSystem.Run(`git lfs pull`, true);
      await OrchestratorSystem.Run(`git lfs checkout || true`, true);
      RemoteClientLogger.log(`Pulled LFS files without explicit token configuration`);

      return;
    } catch {
      /* no-op: best-effort git lfs pull without tokens may fail */
      void 0;
    }

    // Try with GIT_PRIVATE_TOKEN
    try {
      const gitPrivateToken = process.env.GIT_PRIVATE_TOKEN;
      if (gitPrivateToken) {
        RemoteClientLogger.log(`Attempting to pull LFS files with GIT_PRIVATE_TOKEN...`);
        await OrchestratorSystem.Run(`git config --global --unset-all url."https://github.com/".insteadOf || true`);
        await OrchestratorSystem.Run(`git config --global --unset-all url."ssh://git@github.com/".insteadOf || true`);
        await OrchestratorSystem.Run(`git config --global --unset-all url."git@github.com".insteadOf || true`);
        await OrchestratorSystem.Run(
          `git config --global url."https://${gitPrivateToken}@github.com/".insteadOf "https://github.com/"`,
        );
        await OrchestratorSystem.Run(`git lfs pull`, true);
        await OrchestratorSystem.Run(`git lfs checkout || true`, true);
        RemoteClientLogger.log(`Successfully pulled LFS files with GIT_PRIVATE_TOKEN`);

        return;
      }
    } catch (error: any) {
      RemoteClientLogger.logCliError(`Failed with GIT_PRIVATE_TOKEN: ${error.message}`);
    }

    // Try with GITHUB_TOKEN
    try {
      const githubToken = process.env.GITHUB_TOKEN;
      if (githubToken) {
        RemoteClientLogger.log(`Attempting to pull LFS files with GITHUB_TOKEN fallback...`);
        await OrchestratorSystem.Run(`git config --global --unset-all url."https://github.com/".insteadOf || true`);
        await OrchestratorSystem.Run(`git config --global --unset-all url."ssh://git@github.com/".insteadOf || true`);
        await OrchestratorSystem.Run(`git config --global --unset-all url."git@github.com".insteadOf || true`);
        await OrchestratorSystem.Run(
          `git config --global url."https://${githubToken}@github.com/".insteadOf "https://github.com/"`,
        );
        await OrchestratorSystem.Run(`git lfs pull`, true);
        await OrchestratorSystem.Run(`git lfs checkout || true`, true);
        RemoteClientLogger.log(`Successfully pulled LFS files with GITHUB_TOKEN`);

        return;
      }
    } catch (error: any) {
      RemoteClientLogger.logCliError(`Failed with GITHUB_TOKEN: ${error.message}`);
    }

    // If we get here, all strategies failed; continue without failing the build
    RemoteClientLogger.logWarning(`Proceeding without LFS files (no tokens or pull failed)`);
  }
  static async handleRetainedWorkspace() {
    RemoteClientLogger.log(
      `Retained Workspace: ${BuildParameters.shouldUseRetainedWorkspaceMode(Orchestrator.buildParameters)}`,
    );

    // Log cache key explicitly to aid debugging and assertions
    OrchestratorLogger.log(`Cache Key: ${Orchestrator.buildParameters.cacheKey}`);
    if (
      BuildParameters.shouldUseRetainedWorkspaceMode(Orchestrator.buildParameters) &&
      fs.existsSync(OrchestratorFolders.ToLinuxFolder(OrchestratorFolders.uniqueOrchestratorJobFolderAbsolute)) &&
      fs.existsSync(OrchestratorFolders.ToLinuxFolder(path.join(OrchestratorFolders.repoPathAbsolute, `.git`)))
    ) {
      OrchestratorLogger.log(`Retained Workspace Already Exists!`);
      process.chdir(OrchestratorFolders.ToLinuxFolder(OrchestratorFolders.repoPathAbsolute));
      await OrchestratorSystem.Run(`git fetch --all --tags || true`);
      const retainedBranchForPrFetch = Orchestrator.buildParameters.branch || '';
      if (retainedBranchForPrFetch.startsWith('pull/')) {
        // Extract PR number and fetch only that specific ref (e.g., pull/731/merge -> 731)
        const prNumber = retainedBranchForPrFetch.split('/')[1];
        if (prNumber) {
          await OrchestratorSystem.Run(
            `git fetch origin +refs/pull/${prNumber}/merge:refs/remotes/origin/pull/${prNumber}/merge +refs/pull/${prNumber}/head:refs/remotes/origin/pull/${prNumber}/head || true`,
          );
        }
      }
      await OrchestratorSystem.Run(`git lfs pull`);
      await OrchestratorSystem.Run(`git lfs checkout || true`);
      const sha = Orchestrator.buildParameters.gitSha;
      const branch = Orchestrator.buildParameters.branch;
      try {
        await OrchestratorSystem.Run(`git reset --hard "${sha}"`);
        await OrchestratorSystem.Run(`git checkout ${sha}`);
      } catch {
        RemoteClientLogger.logWarning(`Retained workspace: SHA not found, falling back to branch ${branch}`);
        try {
          await OrchestratorSystem.Run(`git checkout ${branch}`);
        } catch (error) {
          if ((branch || '').startsWith('pull/')) {
            await OrchestratorSystem.Run(`git checkout origin/${branch}`);
          } else {
            throw error;
          }
        }
      }

      return true;
    }

    return false;
  }
}
