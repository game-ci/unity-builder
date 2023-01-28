import fs from 'fs';
import CloudRunner from '../cloud-runner';
import { CloudRunnerFolders } from '../services/cloud-runner-folders';
import { Caching } from './caching';
import { LfsHashing } from '../services/lfs-hashing';
import { RemoteClientLogger } from './remote-client-logger';
import path from 'path';
import { assert } from 'console';
import CloudRunnerLogger from '../services/cloud-runner-logger';
import { CliFunction } from '../../cli/cli-functions-repository';
import { CloudRunnerSystem } from '../services/cloud-runner-system';
import YAML from 'yaml';
import GitHub from '../../github';

export class RemoteClient {
  public static async bootstrapRepository() {
    try {
      await CloudRunnerSystem.Run(`mkdir -p ${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.repoPathAbsolute)}`);
      await CloudRunnerSystem.Run(
        `mkdir -p ${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.cacheFolderForCacheKeyFull)}`,
      );
      process.chdir(CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.repoPathAbsolute));
      await RemoteClient.cloneRepoWithoutLFSFiles();
      await RemoteClient.replaceLargePackageReferencesWithSharedReferences();
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
    } catch (error) {
      throw error;
    }
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
      CloudRunner.buildParameters.retainWorkspace &&
      fs.existsSync(path.join(CloudRunnerFolders.repoPathAbsolute, `.git`))
    ) {
      process.chdir(CloudRunnerFolders.repoPathAbsolute);
      RemoteClientLogger.log(
        `${CloudRunnerFolders.repoPathAbsolute} repo exists - skipping clone - retained workspace mode ${CloudRunner.buildParameters.retainWorkspace}`,
      );
      await CloudRunnerSystem.Run(`git fetch && git reset --hard ${CloudRunner.buildParameters.gitSha}`);

      return;
    }

    if (fs.existsSync(CloudRunnerFolders.repoPathAbsolute)) {
      RemoteClientLogger.log(`${CloudRunnerFolders.repoPathAbsolute} repo exists cleaning up`);
      await CloudRunnerSystem.Run(`rm -r ${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.repoPathAbsolute)}`);
    }

    try {
      RemoteClientLogger.log(`Initializing source repository for cloning with caching of LFS files`);
      await CloudRunnerSystem.Run(`git config --global advice.detachedHead false`);
      RemoteClientLogger.log(`Cloning the repository being built:`);
      await CloudRunnerSystem.Run(`git config --global filter.lfs.smudge "git-lfs smudge --skip -- %f"`);
      await CloudRunnerSystem.Run(`git config --global filter.lfs.process "git-lfs filter-process --skip"`);
      await CloudRunnerSystem.Run(
        `git clone -q ${CloudRunnerFolders.targetBuildRepoUrl} ${path.basename(CloudRunnerFolders.repoPathAbsolute)}`,
      );
      process.chdir(CloudRunnerFolders.repoPathAbsolute);
      await CloudRunnerSystem.Run(`git lfs install`);
      assert(fs.existsSync(`.git`), 'git folder exists');
      RemoteClientLogger.log(`${CloudRunner.buildParameters.branch}`);
      await CloudRunnerSystem.Run(`git checkout ${CloudRunner.buildParameters.branch}`);
      if (CloudRunner.buildParameters.gitSha !== undefined) {
        await CloudRunnerSystem.Run(`git checkout ${CloudRunner.buildParameters.gitSha}`);
      } else {
        RemoteClientLogger.log(`buildParameter Git Sha is empty`);
      }

      assert(fs.existsSync(path.join(`.git`, `lfs`)), 'LFS folder should not exist before caching');
      RemoteClientLogger.log(`Checked out ${CloudRunner.buildParameters.branch}`);
    } catch (error) {
      await CloudRunnerSystem.Run(`tree -L 2 ${CloudRunnerFolders.uniqueCloudRunnerJobFolderAbsolute}`);
      throw error;
    }
  }

  static async replaceLargePackageReferencesWithSharedReferences() {
    CloudRunnerLogger.log(`Use Shared Pkgs ${CloudRunner.buildParameters.useSharedLargePackages}`);
    GitHub.updateGitHubCheck(`Use Shared Pkgs ${CloudRunner.buildParameters.useSharedLargePackages}`, ``);
    if (CloudRunner.buildParameters.useSharedLargePackages) {
      await CloudRunnerSystem.Run(`tree -L 2 ${CloudRunnerFolders.projectPathAbsolute}`);
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
    await CloudRunnerSystem.Run(`git lfs pull`);
    RemoteClientLogger.log(`pulled latest LFS files`);
    assert(fs.existsSync(CloudRunnerFolders.lfsFolderAbsolute));
  }

  @CliFunction(`remote-cli-pre-build`, `sets up a repository, usually before a game-ci build`)
  static async runRemoteClientJob() {
    // await CloudRunnerSystem.Run(`tree -L 2 ${CloudRunnerFolders.uniqueCloudRunnerJobFolderAbsolute}`);
    RemoteClient.handleRetainedWorkspace();

    // await CloudRunnerSystem.Run(`tree -L 2 ${CloudRunnerFolders.uniqueCloudRunnerJobFolderAbsolute}`);
    await RemoteClient.bootstrapRepository();

    // await CloudRunnerSystem.Run(`tree -L 2 ${CloudRunnerFolders.uniqueCloudRunnerJobFolderAbsolute}`);
    await RemoteClient.runCustomHookFiles(`before-build`);

    // await CloudRunnerSystem.Run(`tree -L 2 ${CloudRunnerFolders.uniqueCloudRunnerJobFolderAbsolute}`);
  }
  static async runCustomHookFiles(hookLifecycle: string) {
    RemoteClientLogger.log(`RunCustomHookFiles: ${hookLifecycle}`);
    const gameCiCustomHooksPath = path.join(CloudRunnerFolders.repoPathAbsolute, `game-ci`, `hooks`);
    const files = fs.readdirSync(gameCiCustomHooksPath);
    for (const file of files) {
      const fileContents = fs.readFileSync(path.join(gameCiCustomHooksPath, file), `utf8`);
      const fileContentsObject = YAML.parse(fileContents.toString());
      if (fileContentsObject.hook === hookLifecycle) {
        RemoteClientLogger.log(`Active Hook File ${file} \n \n file contents: \n ${fileContents}`);
        await CloudRunnerSystem.Run(fileContentsObject.commands);
      }
    }
  }
  static handleRetainedWorkspace() {
    if (!CloudRunner.buildParameters.retainWorkspace) {
      return;
    }
    RemoteClientLogger.log(`Retained Workspace: ${CloudRunner.lockedWorkspace !== undefined}`);
  }
}
