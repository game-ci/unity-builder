import fs from 'fs';
import CloudRunner from '../../cloud-runner/cloud-runner';
import { CloudRunnerFolders } from '../../cloud-runner/services/cloud-runner-folders';
import { Caching } from './remote-client-services/caching';
import { LFSHashing } from './remote-client-services/lfs-hashing';
import { CloudRunnerSystem } from './remote-client-services/cloud-runner-system';
import { RemoteClientLogger } from './remote-client-services/remote-client-logger';
import path from 'path';
import { assert } from 'console';

export class SetupCloudRunnerRepository {
  public static async run() {
    try {
      await CloudRunnerSystem.Run(`mkdir -p ${CloudRunnerFolders.buildPathFull}`);
      await CloudRunnerSystem.Run(`mkdir -p ${CloudRunnerFolders.repoPathFull}`);
      await CloudRunnerSystem.Run(`mkdir -p ${CloudRunnerFolders.cacheFolderFull}`);

      process.chdir(CloudRunnerFolders.repoPathFull);
      await SetupCloudRunnerRepository.cloneRepoWithoutLFSFiles();
      const lfsHashes = await LFSHashing.createLFSHashFiles();
      if (fs.existsSync(CloudRunnerFolders.libraryFolderFull)) {
        RemoteClientLogger.logWarning(`!Warning!: The Unity library was included in the git repository`);
      }
      await Caching.PullFromCache(
        CloudRunnerFolders.lfsCacheFolderFull,
        CloudRunnerFolders.lfsDirectoryFull,
        `${lfsHashes.lfsGuidSum}`,
      );
      await SetupCloudRunnerRepository.pullLatestLFS();
      await Caching.PushToCache(
        CloudRunnerFolders.lfsCacheFolderFull,
        CloudRunnerFolders.lfsDirectoryFull,
        `${lfsHashes.lfsGuidSum}`,
      );
      await Caching.PullFromCache(CloudRunnerFolders.libraryCacheFolderFull, CloudRunnerFolders.libraryFolderFull);
      Caching.handleCachePurging();
    } catch (error) {
      throw error;
    }
  }

  private static async cloneRepoWithoutLFSFiles() {
    try {
      process.chdir(`${CloudRunnerFolders.repoPathFull}`);
      RemoteClientLogger.log(`Initializing source repository for cloning with caching of LFS files`);
      await CloudRunnerSystem.Run(`git config --global advice.detachedHead false`);
      RemoteClientLogger.log(`Cloning the repository being built:`);
      await CloudRunnerSystem.Run(`git config --global filter.lfs.smudge "git-lfs smudge --skip -- %f"`);
      await CloudRunnerSystem.Run(`git config --global filter.lfs.process "git-lfs filter-process --skip"`);
      await CloudRunnerSystem.Run(
        `git clone ${CloudRunnerFolders.targetBuildRepoUrl} ${path.resolve(
          `..`,
          path.basename(CloudRunnerFolders.repoPathFull),
        )}`,
      );
      await CloudRunnerSystem.Run(`git lfs install`);
      assert(fs.existsSync(`.git`), 'git folder exists');
      RemoteClientLogger.log(`${CloudRunner.buildParameters.branch}`);
      await CloudRunnerSystem.Run(`git checkout ${CloudRunner.buildParameters.branch}`);
      assert(fs.existsSync(path.join(`.git`, `lfs`)), 'LFS folder should not exist before caching');
      RemoteClientLogger.log(`Checked out ${process.env.GITHUB_SHA}`);
    } catch (error) {
      throw error;
    }
  }

  private static async pullLatestLFS() {
    if (CloudRunner.buildParameters.cloudRunnerIntegrationTests) {
      await CloudRunnerSystem.Run(`ls -lh ${CloudRunnerFolders.lfsDirectoryFull}/..`);
    }
    process.chdir(CloudRunnerFolders.repoPathFull);
    await CloudRunnerSystem.Run(`git config --global filter.lfs.smudge "git-lfs smudge -- %f"`);
    await CloudRunnerSystem.Run(`git config --global filter.lfs.process "git-lfs filter-process"`);
    await CloudRunnerSystem.Run(`git lfs pull`);
    RemoteClientLogger.log(`pulled latest LFS files`);
    assert(fs.existsSync(CloudRunnerFolders.lfsDirectoryFull));

    if (CloudRunner.buildParameters.cloudRunnerIntegrationTests) {
      await CloudRunnerSystem.Run(`ls -lh ${CloudRunnerFolders.lfsDirectoryFull}/..`);
    }
  }
}
