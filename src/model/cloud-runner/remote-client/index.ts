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

export class RemoteClient {
  @CliFunction(`remote-cli-pre-build`, `sets up a repository, usually before a game-ci build`)
  static async setupRemoteClient() {
    CloudRunnerLogger.log(`bootstrap game ci cloud runner...`);
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

    let lingeringLine = '';

    process.stdin.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');

      lines[0] = lingeringLine + lines[0];
      lingeringLine = lines.pop() || '';

      for (const element of lines) {
        if (CloudRunnerOptions.providerStrategy !== 'k8s') {
          CloudRunnerLogger.log(element);
        } else {
          fs.appendFileSync(logFile, element);
          CloudRunnerLogger.log(element);
        }
      }
    });

    process.stdin.on('end', () => {
      if (CloudRunnerOptions.providerStrategy !== 'k8s') {
        CloudRunnerLogger.log(lingeringLine);
      } else {
        fs.appendFileSync(logFile, lingeringLine);
        CloudRunnerLogger.log(lingeringLine);
      }
    });
  }

  @CliFunction(`remote-cli-post-build`, `runs a cloud runner build`)
  public static async remoteClientPostBuild(): Promise<string> {
    RemoteClientLogger.log(`Running POST build tasks`);

    await Caching.PushToCache(
      CloudRunnerFolders.ToLinuxFolder(`${CloudRunnerFolders.cacheFolderForCacheKeyFull}/Library`),
      CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.libraryFolderAbsolute),
      `lib-${CloudRunner.buildParameters.buildGuid}`,
    );

    await Caching.PushToCache(
      CloudRunnerFolders.ToLinuxFolder(`${CloudRunnerFolders.cacheFolderForCacheKeyFull}/build`),
      CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.projectBuildFolderAbsolute),
      `build-${CloudRunner.buildParameters.buildGuid}`,
    );

    if (!BuildParameters.shouldUseRetainedWorkspaceMode(CloudRunner.buildParameters)) {
      await CloudRunnerSystem.Run(
        `rm -r ${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.uniqueCloudRunnerJobFolderAbsolute)}`,
      );
    }

    await RemoteClient.runCustomHookFiles(`after-build`);

    // WIP - need to give the pod permissions to create config map
    await RemoteClientLogger.handleLogManagementPostJob();

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
      await CloudRunnerSystem.Run(
        `git clone ${CloudRunnerFolders.targetBuildRepoUrl} ${path.basename(CloudRunnerFolders.repoPathAbsolute)}`,
      );
    } catch (error: any) {
      throw error;
    }
    process.chdir(CloudRunnerFolders.repoPathAbsolute);
    await CloudRunnerSystem.Run(`git lfs install`);
    assert(fs.existsSync(`.git`), 'git folder exists');
    RemoteClientLogger.log(`${CloudRunner.buildParameters.branch}`);
    if (CloudRunner.buildParameters.gitSha !== undefined) {
      await CloudRunnerSystem.Run(`git checkout ${CloudRunner.buildParameters.gitSha}`);
    } else {
      await CloudRunnerSystem.Run(`git checkout ${CloudRunner.buildParameters.branch}`);
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
    if (!CloudRunner.buildParameters.skipLfs) {
      await CloudRunnerSystem.Run(`git lfs pull`);
      RemoteClientLogger.log(`pulled latest LFS files`);
      assert(fs.existsSync(CloudRunnerFolders.lfsFolderAbsolute));
    }
  }
  static async handleRetainedWorkspace() {
    RemoteClientLogger.log(
      `Retained Workspace: ${BuildParameters.shouldUseRetainedWorkspaceMode(CloudRunner.buildParameters)}`,
    );
    if (
      BuildParameters.shouldUseRetainedWorkspaceMode(CloudRunner.buildParameters) &&
      fs.existsSync(CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.uniqueCloudRunnerJobFolderAbsolute)) &&
      fs.existsSync(CloudRunnerFolders.ToLinuxFolder(path.join(CloudRunnerFolders.repoPathAbsolute, `.git`)))
    ) {
      CloudRunnerLogger.log(`Retained Workspace Already Exists!`);
      process.chdir(CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.repoPathAbsolute));
      await CloudRunnerSystem.Run(`git fetch`);
      await CloudRunnerSystem.Run(`git lfs pull`);
      await CloudRunnerSystem.Run(`git reset --hard "${CloudRunner.buildParameters.gitSha}"`);
      await CloudRunnerSystem.Run(`git checkout ${CloudRunner.buildParameters.gitSha}`);

      return true;
    }

    return false;
  }
}
