import { assert } from 'console';
import fs from 'fs';
import CloudRunnerLogger from '../../cloud-runner/services/cloud-runner-logger';
import { CloudRunnerState } from '../../cloud-runner/state/cloud-runner-state';
import { Caching } from './caching';
import { LFSHashing } from './lfs-hashing';
import { CloudRunnerAgentSystem } from './cloud-runner-agent-system';
import path from 'path';

export class CloudRunnerRepositorySetup {
  static LFS_ASSETS_HASH;
  public static async run() {
    try {
      await CloudRunnerAgentSystem.Run(`mkdir -p ${CloudRunnerState.buildPathFull}`);
      await CloudRunnerAgentSystem.Run(`mkdir -p ${CloudRunnerState.repoPathFull}`);
      await CloudRunnerRepositorySetup.cloneRepoWithoutLFSFiles();

      CloudRunnerRepositorySetup.LFS_ASSETS_HASH = await LFSHashing.createLFSHashFiles();
      CloudRunnerLogger.logCli(CloudRunnerRepositorySetup.LFS_ASSETS_HASH);
      await LFSHashing.printLFSHashState();
      CloudRunnerLogger.logCli(`Library Caching`);
      assert(
        !fs.existsSync(CloudRunnerState.libraryFolderFull),
        `!Warning!: The Unity library was included in the git repository`,
      );
      CloudRunnerLogger.logCli(`LFS Caching`);
      await CloudRunnerAgentSystem.Run(`tree ${path.join(CloudRunnerState.lfsDirectory, '..')}`);
      await Caching.PullFromCache(
        CloudRunnerState.lfsCacheFolder,
        CloudRunnerState.lfsDirectory,
        `${CloudRunnerRepositorySetup.LFS_ASSETS_HASH}.zip`,
      );
      await CloudRunnerAgentSystem.Run(`tree ${path.join(CloudRunnerState.lfsDirectory, '..')}`);
      await Caching.printCacheState(CloudRunnerState.lfsCacheFolder, CloudRunnerState.libraryCacheFolder);
      await CloudRunnerRepositorySetup.pullLatestLFS();
      await Caching.PushToCache(
        CloudRunnerState.lfsCacheFolder,
        CloudRunnerState.lfsDirectory,
        CloudRunnerRepositorySetup.LFS_ASSETS_HASH,
      );
      await CloudRunnerAgentSystem.Run(`tree ${path.join(CloudRunnerState.libraryCacheFolder, '..')}`);
      await Caching.PullFromCache(CloudRunnerState.libraryCacheFolder, CloudRunnerState.libraryFolderFull);
      await CloudRunnerAgentSystem.Run(`tree ${path.join(CloudRunnerState.libraryCacheFolder, '..')}`);

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
