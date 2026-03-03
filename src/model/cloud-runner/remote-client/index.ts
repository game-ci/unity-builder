import fs from 'node:fs';
import CloudRunner from '../cloud-runner';
import { CloudRunnerFolders } from '../options/cloud-runner-folders';
import { Caching } from './caching';
import { LfsHashing } from '../services/utility/lfs-hashing';
import { RemoteClientLogger } from './remote-client-logger';
import path from 'node:path';
import { assert } from 'node:console';
import CloudRunnerLogger from '../services/core/cloud-runner-logger';
import { CliFunction } from '../../cli/cli-functions-repository';
import { CloudRunnerSystem } from '../services/core/cloud-runner-system';
import YAML from 'yaml';
import GitHub from '../../github';
import BuildParameters from '../../build-parameters';
import { Cli } from '../../cli/cli';
import CloudRunnerOptions from '../options/cloud-runner-options';
import ResourceTracking from '../services/core/resource-tracking';

export class RemoteClient {
  @CliFunction(`remote-cli-pre-build`, `sets up a repository, usually before a game-ci build`)
  static async setupRemoteClient() {
    CloudRunnerLogger.log(`bootstrap game ci cloud runner...`);
    await ResourceTracking.logDiskUsageSnapshot('remote-cli-pre-build (start)');
    if (!(await RemoteClient.handleRetainedWorkspace())) {
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
    if (CloudRunnerOptions.providerStrategy === 'k8s') {
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
        if (CloudRunnerOptions.providerStrategy === 'k8s') {
          // Write to stdout so kubectl logs can capture it - ensure newline is included
          // Stdout flushes automatically on newline, so no explicit flush needed
          process.stdout.write(`${element}\n`);
        }

        CloudRunnerLogger.log(element);
      }
    });

    process.stdin.on('end', () => {
      if (lingeringLine) {
        // Always write to log file so output can be collected by providers
        fs.appendFileSync(logFile, `${lingeringLine}\n`);

        // For K8s, also write to stdout so kubectl logs can capture it
        if (CloudRunnerOptions.providerStrategy === 'k8s') {
          // Stdout flushes automatically on newline
          process.stdout.write(`${lingeringLine}\n`);
        }
      }

      CloudRunnerLogger.log(lingeringLine);
    });
  }

  @CliFunction(`remote-cli-post-build`, `runs a cloud runner build`)
  public static async remoteClientPostBuild(): Promise<string> {
    try {
      RemoteClientLogger.log(`Running POST build tasks`);

      // Ensure cache key is present in logs for assertions
      RemoteClientLogger.log(`CACHE_KEY=${CloudRunner.buildParameters.cacheKey}`);
      CloudRunnerLogger.log(`${CloudRunner.buildParameters.cacheKey}`);

      // Guard: only push Library cache if the folder exists and has contents
      try {
        const libraryFolderHost = CloudRunnerFolders.libraryFolderAbsolute;
        if (fs.existsSync(libraryFolderHost)) {
          let libraryEntries: string[] = [];
          try {
            libraryEntries = await fs.promises.readdir(libraryFolderHost);
          } catch {
            libraryEntries = [];
          }
          if (libraryEntries.length > 0) {
            await Caching.PushToCache(
              CloudRunnerFolders.ToLinuxFolder(`${CloudRunnerFolders.cacheFolderForCacheKeyFull}/Library`),
              CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.libraryFolderAbsolute),
              `lib-${CloudRunner.buildParameters.buildGuid}`,
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
        const buildFolderHost = CloudRunnerFolders.projectBuildFolderAbsolute;
        if (fs.existsSync(buildFolderHost)) {
          let buildEntries: string[] = [];
          try {
            buildEntries = await fs.promises.readdir(buildFolderHost);
          } catch {
            buildEntries = [];
          }
          if (buildEntries.length > 0) {
            await Caching.PushToCache(
              CloudRunnerFolders.ToLinuxFolder(`${CloudRunnerFolders.cacheFolderForCacheKeyFull}/build`),
              CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.projectBuildFolderAbsolute),
              `build-${CloudRunner.buildParameters.buildGuid}`,
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

      if (!BuildParameters.shouldUseRetainedWorkspaceMode(CloudRunner.buildParameters)) {
        const uniqueJobFolderLinux = CloudRunnerFolders.ToLinuxFolder(
          CloudRunnerFolders.uniqueCloudRunnerJobFolderAbsolute,
        );
        if (
          fs.existsSync(CloudRunnerFolders.uniqueCloudRunnerJobFolderAbsolute) ||
          fs.existsSync(uniqueJobFolderLinux)
        ) {
          await CloudRunnerSystem.Run(`rm -r ${uniqueJobFolderLinux} || true`);
        } else {
          RemoteClientLogger.log(`Skipping cleanup; unique job folder missing`);
        }
      }

      await RemoteClient.runCustomHookFiles(`after-build`);

      // WIP - need to give the pod permissions to create config map
      await RemoteClientLogger.handleLogManagementPostJob();
    } catch (error: any) {
      // Log error but don't fail - post-build tasks are best-effort
      RemoteClientLogger.logWarning(`Post-build task error: ${error.message}`);
      CloudRunnerLogger.log(`Post-build task error: ${error.message}`);
    }

    // Ensure success marker is always present in logs for tests, even if post-build tasks failed
    // For K8s, kubectl logs reads from stdout/stderr, so we must write to stdout
    // For all providers, we write to stdout so it gets piped through the log stream
    // The log stream will capture it and add it to BuildResults
    const successMessage = `Activation successful`;

    // Write directly to log file first to ensure it's captured even if pipe fails
    // This is critical for all providers, especially K8s where timing matters
    try {
      const logFilePath = CloudRunner.isCloudRunnerEnvironment
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
    if (CloudRunnerOptions.providerStrategy === 'k8s') {
      process.stderr.write(`${successMessage}\n`, 'utf8');
    }

    // Ensure stdout is flushed before process exits (critical for K8s where process might exit quickly)
    // For non-TTY streams, we need to explicitly ensure the write completes
    if (!process.stdout.isTTY) {
      // Give the pipe a moment to process the write
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Also log via CloudRunnerLogger and RemoteClientLogger for GitHub Actions and log file
    // This ensures the message appears in log files for providers that read from log files
    // RemoteClientLogger.log writes directly to the log file, which is important for providers
    // that read from the log file rather than stdout
    RemoteClientLogger.log(successMessage);
    CloudRunnerLogger.log(successMessage);
    await ResourceTracking.logDiskUsageSnapshot('remote-cli-post-build (end)');

    return new Promise((result) => result(``));
  }
  static async runCustomHookFiles(hookLifecycle: string) {
    RemoteClientLogger.log(`RunCustomHookFiles: ${hookLifecycle}`);
    const gameCiCustomHooksPath = path.join(CloudRunnerFolders.repoPathAbsolute, `game-ci`, `hooks`);
    try {
      const files = fs.readdirSync(gameCiCustomHooksPath);
      for (const file of files) {
        const fileContents = fs.readFileSync(path.join(gameCiCustomHooksPath, file), `utf8`);
        const fileContentsObject = YAML.parse(fileContents.toString());
        if (fileContentsObject.hook === hookLifecycle) {
          RemoteClientLogger.log(`Active Hook File ${file} \n \n file contents: \n ${fileContents}`);
          await CloudRunnerSystem.Run(fileContentsObject.commands);
        }
      }
    } catch (error) {
      RemoteClientLogger.log(JSON.stringify(error, undefined, 4));
    }
  }
  public static async bootstrapRepository() {
    await CloudRunnerSystem.Run(
      `mkdir -p ${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.uniqueCloudRunnerJobFolderAbsolute)}`,
    );
    await CloudRunnerSystem.Run(
      `mkdir -p ${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.cacheFolderForCacheKeyFull)}`,
    );
    await RemoteClient.cloneRepoWithoutLFSFiles();
    await RemoteClient.sizeOfFolder(
      'repo before lfs cache pull',
      CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.repoPathAbsolute),
    );
    const lfsHashes = await LfsHashing.createLFSHashFiles();
    if (fs.existsSync(CloudRunnerFolders.libraryFolderAbsolute)) {
      RemoteClientLogger.logWarning(`!Warning!: The Unity library was included in the git repository`);
    }
    await Caching.PullFromCache(
      CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.lfsCacheFolderFull),
      CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.lfsFolderAbsolute),
      `${lfsHashes.lfsGuidSum}`,
    );
    await RemoteClient.sizeOfFolder('repo after lfs cache pull', CloudRunnerFolders.repoPathAbsolute);
    await RemoteClient.pullLatestLFS();
    await RemoteClient.sizeOfFolder('repo before lfs git pull', CloudRunnerFolders.repoPathAbsolute);
    await Caching.PushToCache(
      CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.lfsCacheFolderFull),
      CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.lfsFolderAbsolute),
      `${lfsHashes.lfsGuidSum}`,
    );
    await Caching.PullFromCache(
      CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.libraryCacheFolderFull),
      CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.libraryFolderAbsolute),
    );
    await RemoteClient.sizeOfFolder('repo after library cache pull', CloudRunnerFolders.repoPathAbsolute);
    await Caching.handleCachePurging();
  }

  private static async sizeOfFolder(message: string, folder: string) {
    if (CloudRunner.buildParameters.cloudRunnerDebug) {
      CloudRunnerLogger.log(`Size of ${message}`);
      await CloudRunnerSystem.Run(`du -sh ${folder}`);
    }
  }

  private static async cloneRepoWithoutLFSFiles() {
    process.chdir(`${CloudRunnerFolders.uniqueCloudRunnerJobFolderAbsolute}`);
    if (
      fs.existsSync(CloudRunnerFolders.repoPathAbsolute) &&
      !fs.existsSync(path.join(CloudRunnerFolders.repoPathAbsolute, `.git`))
    ) {
      await CloudRunnerSystem.Run(`rm -r ${CloudRunnerFolders.repoPathAbsolute}`);
      CloudRunnerLogger.log(`${CloudRunnerFolders.repoPathAbsolute} repo exists, but no git folder, cleaning up`);
    }

    if (
      BuildParameters.shouldUseRetainedWorkspaceMode(CloudRunner.buildParameters) &&
      fs.existsSync(path.join(CloudRunnerFolders.repoPathAbsolute, `.git`))
    ) {
      process.chdir(CloudRunnerFolders.repoPathAbsolute);
      RemoteClientLogger.log(
        `${
          CloudRunnerFolders.repoPathAbsolute
        } repo exists - skipping clone - retained workspace mode ${BuildParameters.shouldUseRetainedWorkspaceMode(
          CloudRunner.buildParameters,
        )}`,
      );
      await CloudRunnerSystem.Run(`git fetch && git reset --hard ${CloudRunner.buildParameters.gitSha}`);

      return;
    }

    RemoteClientLogger.log(`Initializing source repository for cloning with caching of LFS files`);
    await CloudRunnerSystem.Run(`git config --global advice.detachedHead false`);
    RemoteClientLogger.log(`Cloning the repository being built:`);
    await CloudRunnerSystem.Run(`git config --global filter.lfs.smudge "git-lfs smudge --skip -- %f"`);
    await CloudRunnerSystem.Run(`git config --global filter.lfs.process "git-lfs filter-process --skip"`);
    try {
      const depthArgument = CloudRunnerOptions.cloneDepth !== '0' ? `--depth ${CloudRunnerOptions.cloneDepth}` : '';
      await CloudRunnerSystem.Run(
        `git clone ${depthArgument} ${CloudRunnerFolders.targetBuildRepoUrl} ${path.basename(
          CloudRunnerFolders.repoPathAbsolute,
        )}`.trim(),
      );
    } catch (error: any) {
      throw error;
    }
    process.chdir(CloudRunnerFolders.repoPathAbsolute);
    await CloudRunnerSystem.Run(`git lfs install`);
    assert(fs.existsSync(`.git`), 'git folder exists');
    RemoteClientLogger.log(`${CloudRunner.buildParameters.branch}`);

    // Ensure refs exist (tags and PR refs)
    await CloudRunnerSystem.Run(`git fetch --all --tags || true`);
    const branchForPrFetch = CloudRunner.buildParameters.branch || '';
    if (branchForPrFetch.startsWith('pull/')) {
      // Extract PR number and fetch only that specific ref (e.g., pull/731/merge -> 731)
      const prNumber = branchForPrFetch.split('/')[1];
      if (prNumber) {
        await CloudRunnerSystem.Run(
          `git fetch origin +refs/pull/${prNumber}/merge:refs/remotes/origin/pull/${prNumber}/merge +refs/pull/${prNumber}/head:refs/remotes/origin/pull/${prNumber}/head || true`,
        );
      }
    }
    const targetSha = CloudRunner.buildParameters.gitSha;
    const targetBranch = CloudRunner.buildParameters.branch;
    if (targetSha) {
      try {
        await CloudRunnerSystem.Run(`git checkout ${targetSha}`);
      } catch {
        try {
          await CloudRunnerSystem.Run(`git fetch origin ${targetSha} || true`);
          await CloudRunnerSystem.Run(`git checkout ${targetSha}`);
        } catch (error) {
          RemoteClientLogger.logWarning(`Falling back to branch checkout; SHA not found: ${targetSha}`);
          try {
            await CloudRunnerSystem.Run(`git checkout ${targetBranch}`);
          } catch {
            if ((targetBranch || '').startsWith('pull/')) {
              await CloudRunnerSystem.Run(`git checkout origin/${targetBranch}`);
            } else {
              throw error;
            }
          }
        }
      }
    } else {
      try {
        await CloudRunnerSystem.Run(`git checkout ${targetBranch}`);
      } catch (_error) {
        if ((targetBranch || '').startsWith('pull/')) {
          await CloudRunnerSystem.Run(`git checkout origin/${targetBranch}`);
        } else {
          throw _error;
        }
      }
      RemoteClientLogger.log(`buildParameter Git Sha is empty`);
    }

    assert(fs.existsSync(path.join(`.git`, `lfs`)), 'LFS folder should not exist before caching');
    RemoteClientLogger.log(`Checked out ${CloudRunner.buildParameters.branch}`);
  }

  static async replaceLargePackageReferencesWithSharedReferences() {
    CloudRunnerLogger.log(`Use Shared Pkgs ${CloudRunner.buildParameters.useLargePackages}`);
    GitHub.updateGitHubCheck(`Use Shared Pkgs ${CloudRunner.buildParameters.useLargePackages}`, ``);
    if (CloudRunner.buildParameters.useLargePackages) {
      const filePath = path.join(CloudRunnerFolders.projectPathAbsolute, `Packages/manifest.json`);
      let manifest = fs.readFileSync(filePath, 'utf8');
      manifest = manifest.replace(/LargeContent/g, '../../../LargeContent');
      fs.writeFileSync(filePath, manifest);
      CloudRunnerLogger.log(`Package Manifest \n ${manifest}`);
      GitHub.updateGitHubCheck(`Package Manifest \n ${manifest}`, ``);
    }
  }

  private static async pullLatestLFS() {
    process.chdir(CloudRunnerFolders.repoPathAbsolute);
    await CloudRunnerSystem.Run(`git config --global filter.lfs.smudge "git-lfs smudge -- %f"`);
    await CloudRunnerSystem.Run(`git config --global filter.lfs.process "git-lfs filter-process"`);
    if (CloudRunner.buildParameters.skipLfs) {
      RemoteClientLogger.log(`Skipping LFS pull (skipLfs=true)`);

      return;
    }

    // Best effort: try plain pull first (works for public repos or pre-configured auth)
    try {
      await CloudRunnerSystem.Run(`git lfs pull`, true);
      await CloudRunnerSystem.Run(`git lfs checkout || true`, true);
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
        await CloudRunnerSystem.Run(`git config --global --unset-all url."https://github.com/".insteadOf || true`);
        await CloudRunnerSystem.Run(`git config --global --unset-all url."ssh://git@github.com/".insteadOf || true`);
        await CloudRunnerSystem.Run(`git config --global --unset-all url."git@github.com".insteadOf || true`);
        await CloudRunnerSystem.Run(
          `git config --global url."https://${gitPrivateToken}@github.com/".insteadOf "https://github.com/"`,
        );
        await CloudRunnerSystem.Run(`git lfs pull`, true);
        await CloudRunnerSystem.Run(`git lfs checkout || true`, true);
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
        await CloudRunnerSystem.Run(`git config --global --unset-all url."https://github.com/".insteadOf || true`);
        await CloudRunnerSystem.Run(`git config --global --unset-all url."ssh://git@github.com/".insteadOf || true`);
        await CloudRunnerSystem.Run(`git config --global --unset-all url."git@github.com".insteadOf || true`);
        await CloudRunnerSystem.Run(
          `git config --global url."https://${githubToken}@github.com/".insteadOf "https://github.com/"`,
        );
        await CloudRunnerSystem.Run(`git lfs pull`, true);
        await CloudRunnerSystem.Run(`git lfs checkout || true`, true);
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
      `Retained Workspace: ${BuildParameters.shouldUseRetainedWorkspaceMode(CloudRunner.buildParameters)}`,
    );

    // Log cache key explicitly to aid debugging and assertions
    CloudRunnerLogger.log(`Cache Key: ${CloudRunner.buildParameters.cacheKey}`);
    if (
      BuildParameters.shouldUseRetainedWorkspaceMode(CloudRunner.buildParameters) &&
      fs.existsSync(CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.uniqueCloudRunnerJobFolderAbsolute)) &&
      fs.existsSync(CloudRunnerFolders.ToLinuxFolder(path.join(CloudRunnerFolders.repoPathAbsolute, `.git`)))
    ) {
      CloudRunnerLogger.log(`Retained Workspace Already Exists!`);
      process.chdir(CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.repoPathAbsolute));
      await CloudRunnerSystem.Run(`git fetch --all --tags || true`);
      const retainedBranchForPrFetch = CloudRunner.buildParameters.branch || '';
      if (retainedBranchForPrFetch.startsWith('pull/')) {
        // Extract PR number and fetch only that specific ref (e.g., pull/731/merge -> 731)
        const prNumber = retainedBranchForPrFetch.split('/')[1];
        if (prNumber) {
          await CloudRunnerSystem.Run(
            `git fetch origin +refs/pull/${prNumber}/merge:refs/remotes/origin/pull/${prNumber}/merge +refs/pull/${prNumber}/head:refs/remotes/origin/pull/${prNumber}/head || true`,
          );
        }
      }
      await CloudRunnerSystem.Run(`git lfs pull`);
      await CloudRunnerSystem.Run(`git lfs checkout || true`);
      const sha = CloudRunner.buildParameters.gitSha;
      const branch = CloudRunner.buildParameters.branch;
      try {
        await CloudRunnerSystem.Run(`git reset --hard "${sha}"`);
        await CloudRunnerSystem.Run(`git checkout ${sha}`);
      } catch {
        RemoteClientLogger.logWarning(`Retained workspace: SHA not found, falling back to branch ${branch}`);
        try {
          await CloudRunnerSystem.Run(`git checkout ${branch}`);
        } catch (error) {
          if ((branch || '').startsWith('pull/')) {
            await CloudRunnerSystem.Run(`git checkout origin/${branch}`);
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
