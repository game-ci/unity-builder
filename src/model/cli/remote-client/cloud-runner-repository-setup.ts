import { assert } from 'console';
import fs from 'fs';
import path from 'path';
import CloudRunnerLogger from '../../cloud-runner/services/cloud-runner-logger';
import { CloudRunnerState } from '../../cloud-runner/state/cloud-runner-state';
import { Caching } from './caching';
import { LFSHashing } from './lfs-hashing';
import { CloudRunnerAgentSystem } from './remote-client-system';

export class CloudRunnerRepositorySetup {
  static LFS_ASSETS_HASH;
  public static async run() {
    try {
      fs.mkdirSync(CloudRunnerState.buildPathFull);
      fs.mkdirSync(CloudRunnerState.repoPathFull);
      await CloudRunnerRepositorySetup.cloneRepoWithoutLFSFiles();

      CloudRunnerRepositorySetup.LFS_ASSETS_HASH = await LFSHashing.createLFSHashFiles();
      CloudRunnerLogger.logCli(CloudRunnerRepositorySetup.LFS_ASSETS_HASH);
      await LFSHashing.printLFSHashState();
      const lfsCacheFolder = path.join(CloudRunnerState.cacheFolderFull, `lfs`);
      const libraryCacheFolder = path.join(CloudRunnerState.cacheFolderFull, `lib`);
      await CloudRunnerAgentSystem.Run(`tree ${CloudRunnerState.repoPathFull}`);
      CloudRunnerLogger.logCli(`Library Caching`);
      assert(
        fs.existsSync(CloudRunnerState.libraryFolderFull),
        `!Warning!: The Unity library was included in the git repository`,
      );
      await Caching.PullFromCache(libraryCacheFolder, CloudRunnerState.libraryFolderFull);
      CloudRunnerLogger.logCli(`LFS Caching`);
      await Caching.PullFromCache(
        lfsCacheFolder,
        CloudRunnerState.lfsDirectory,
        `${CloudRunnerRepositorySetup.LFS_ASSETS_HASH}.zip`,
      );
      await CloudRunnerAgentSystem.Run(`tree ${CloudRunnerState.repoPathFull}`);
      await Caching.printCacheState(lfsCacheFolder, libraryCacheFolder);
      await CloudRunnerRepositorySetup.pullLatestLFS();
      await CloudRunnerAgentSystem.Run(`tree ${CloudRunnerState.repoPathFull}`);
      await CloudRunnerAgentSystem.Run(`tree ${CloudRunnerState.cacheFolderFull}`);
      await Caching.PushToCache(
        lfsCacheFolder,
        CloudRunnerState.lfsDirectory,
        CloudRunnerRepositorySetup.LFS_ASSETS_HASH,
      );
      await CloudRunnerAgentSystem.Run(`tree ${CloudRunnerState.cacheFolderFull}`);
      Caching.handleCachePurging();
    } catch (error) {
      throw error;
    }
  }

  private static async cloneRepoWithoutLFSFiles() {
    try {
      CloudRunnerLogger.logCli(`Initializing source repository for cloning with caching of LFS files`);
      process.chdir(CloudRunnerState.repoPathFull);
      await CloudRunnerAgentSystem.Run(`git config --global advice.detachedHead false`);
      CloudRunnerLogger.logCli(`Cloning the repository being built:`);
      await CloudRunnerAgentSystem.Run(`git lfs install --skip-smudge`);
      CloudRunnerLogger.logCli(CloudRunnerState.targetBuildRepoUrl);
      await CloudRunnerAgentSystem.Run(
        `git clone ${CloudRunnerState.targetBuildRepoUrl} ${CloudRunnerState.repoPathFull}`,
      );
      await CloudRunnerAgentSystem.Run(`ls -lh`);
      await CloudRunnerAgentSystem.Run(`tree`);
      CloudRunnerLogger.logCli(`${CloudRunnerState.buildParams.branch}`);
      await CloudRunnerAgentSystem.Run(`git checkout ${CloudRunnerState.buildParams.branch}`);
      CloudRunnerLogger.logCli(`Checked out ${process.env.GITHUB_SHA}`);
    } catch (error) {
      throw error;
    }
  }

  private static async pullLatestLFS() {
    process.chdir(CloudRunnerState.repoPathFull);
    await CloudRunnerAgentSystem.Run(`git lfs pull`);
    CloudRunnerLogger.logCli(`pulled latest LFS files`);
  }
}
