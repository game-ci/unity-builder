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

export class RemoteClient {
  public static async bootstrapRepository() {
    try {
      await CloudRunnerSystem.Run(
        `mkdir -p ${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.uniqueCloudRunnerJobFolderAbsolute)}`,
      );
      await CloudRunnerSystem.Run(`mkdir -p ${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.repoPathAbsolute)}`);
      await CloudRunnerSystem.Run(`mkdir -p ${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.cacheFolderFull)}`);
      process.chdir(CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.repoPathAbsolute));
      await RemoteClient.cloneRepoWithoutLFSFiles();
      RemoteClient.replaceLargePackageReferencesWithSharedReferences();
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
    if (CloudRunner.buildParameters.cloudRunnerIntegrationTests) {
      CloudRunnerLogger.log(`Size of ${message}`);
      await CloudRunnerSystem.Run(`du -sh ${folder}`);
    }
  }

  private static async cloneRepoWithoutLFSFiles() {
    process.chdir(`${CloudRunnerFolders.repoPathAbsolute}`);
    if (CloudRunner.buildParameters.cloudRunnerIntegrationTests) {
      await CloudRunnerSystem.Run(`tree -L 2 ./..`);
    }

    if (fs.existsSync(path.join(CloudRunnerFolders.repoPathAbsolute, `.git`))) {
      RemoteClientLogger.log(
        `${CloudRunnerFolders.repoPathAbsolute} repo exists - skipping clone - retained workspace mode ${CloudRunner.buildParameters.retainWorkspace}`,
      );
      await CloudRunnerSystem.Run(`git reset --hard ${CloudRunner.buildParameters.gitSha}`);

      return;
    }
    try {
      RemoteClientLogger.log(`Initializing source repository for cloning with caching of LFS files`);
      await CloudRunnerSystem.Run(`git config --global advice.detachedHead false`);
      RemoteClientLogger.log(`Cloning the repository being built:`);
      await CloudRunnerSystem.Run(`git config --global filter.lfs.smudge "git-lfs smudge --skip -- %f"`);
      await CloudRunnerSystem.Run(`git config --global filter.lfs.process "git-lfs filter-process --skip"`);
      await CloudRunnerSystem.Run(
        `git clone -q ${CloudRunnerFolders.targetBuildRepoUrl} ${path.resolve(
          `..`,
          path.basename(CloudRunnerFolders.repoPathAbsolute),
        )}`,
      );
      await CloudRunnerSystem.Run(`git lfs install`);
      assert(fs.existsSync(`.git`), 'git folder exists');
      RemoteClientLogger.log(`${CloudRunner.buildParameters.branch}`);
      await CloudRunnerSystem.Run(`git checkout ${CloudRunner.buildParameters.branch}`);
      await CloudRunnerSystem.Run(`git checkout ${CloudRunner.buildParameters.gitSha}`);
      assert(fs.existsSync(path.join(`.git`, `lfs`)), 'LFS folder should not exist before caching');
      RemoteClientLogger.log(`Checked out ${CloudRunner.buildParameters.branch}`);
    } catch (error) {
      await CloudRunnerSystem.Run(`tree -L 2 ${CloudRunnerFolders.repoPathAbsolute}/..`);
      throw error;
    }
  }

  static replaceLargePackageReferencesWithSharedReferences() {
    const manifest = fs.readFileSync(
      path.join(CloudRunnerFolders.projectPathAbsolute, `Packages/manifest.json`),
      'utf8',
    );
    if (CloudRunner.buildParameters.cloudRunnerIntegrationTests) {
      CloudRunnerLogger.log(manifest);
    }
    if (CloudRunner.buildParameters.useSharedLargePackages) {
      manifest.replace(/LargePackages/g, '../../LargePackages');
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
    RemoteClient.handleRetainedWorkspace();
    await RemoteClient.bootstrapRepository();
    await RemoteClient.runCustomHookFiles(`before-build`);
  }
  static async runCustomHookFiles(hookLifecycle: string) {
    RemoteClientLogger.log(`RunCustomHookFiles: ${hookLifecycle}`);
    const gameCiCustomHooksPath = path.join(CloudRunnerFolders.repoPathAbsolute, `game-ci`, `hooks`);
    const files = fs.readdirSync(gameCiCustomHooksPath);
    for (const file of files) {
      const fileContents = fs.readFileSync(path.join(gameCiCustomHooksPath, file), `utf8`);
      const fileContentsObject = YAML.parse(fileContents.toString());
      if (fileContentsObject.hook === hookLifecycle) {
        RemoteClientLogger.log(`Active Hook File ${file} contents: ${fileContents}`);
        await CloudRunnerSystem.Run(fileContentsObject.commands);
      }
    }
  }
  static handleRetainedWorkspace() {
    if (!CloudRunner.buildParameters.retainWorkspace || !CloudRunner.lockedWorkspace) {
      return;
    }
    RemoteClientLogger.log(`Retained Workspace: ${CloudRunner.lockedWorkspace}`);
  }
}
