import { assert } from 'console';
import fs from 'fs';
import path from 'path';
import CloudRunnerLogger from '../../cloud-runner/services/cloud-runner-logger';
import { CloudRunnerState } from '../../cloud-runner/state/cloud-runner-state';
import { Caching } from './caching';
import { LFSHashing } from './lfs-hashing';
import { RemoteClientSystem } from './remote-client-system';

export class SetupRemoteRepository {
  static LFS_ASSETS_HASH;
  public static async run() {
    try {
      fs.mkdirSync(CloudRunnerState.buildPathFull);
      fs.mkdirSync(CloudRunnerState.repoPathFull);
      await SetupRemoteRepository.cloneRepoWithoutLFSFiles();

      SetupRemoteRepository.LFS_ASSETS_HASH = await LFSHashing.createLFSHashFiles();
      CloudRunnerLogger.logCli(SetupRemoteRepository.LFS_ASSETS_HASH);
      await LFSHashing.printLFSHashState();
      const lfsCacheFolder = path.join(CloudRunnerState.cacheFolderFull, `lfs`);
      const libraryCacheFolder = path.join(CloudRunnerState.cacheFolderFull, `lib`);
      await RemoteClientSystem.Run(`tree ${CloudRunnerState.repoPathFull}`);
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
        `${SetupRemoteRepository.LFS_ASSETS_HASH}.zip`,
      );
      await RemoteClientSystem.Run(`tree ${CloudRunnerState.repoPathFull}`);
      await Caching.printCacheState(lfsCacheFolder, libraryCacheFolder);
      await SetupRemoteRepository.pullLatestLFS();
      await RemoteClientSystem.Run(`tree ${CloudRunnerState.repoPathFull}`);
      await RemoteClientSystem.Run(`tree ${CloudRunnerState.cacheFolderFull}`);
      await Caching.PushToCache(lfsCacheFolder, CloudRunnerState.lfsDirectory, SetupRemoteRepository.LFS_ASSETS_HASH);
      await RemoteClientSystem.Run(`tree ${CloudRunnerState.cacheFolderFull}`);
      Caching.handleCachePurging();
    } catch (error) {
      throw error;
    }
  }

  private static async cloneRepoWithoutLFSFiles() {
    try {
      CloudRunnerLogger.logCli(`Initializing source repository for cloning with caching of LFS files`);
      process.chdir(CloudRunnerState.repoPathFull);
      await RemoteClientSystem.Run(`git config --global advice.detachedHead false`);
      CloudRunnerLogger.logCli(`Cloning the repository being built:`);
      await RemoteClientSystem.Run(`git lfs install --skip-smudge`);
      CloudRunnerLogger.logCli(CloudRunnerState.targetBuildRepoUrl);
      await RemoteClientSystem.Run(`git clone ${CloudRunnerState.targetBuildRepoUrl} ${CloudRunnerState.repoPathFull}`);
      await RemoteClientSystem.Run(`ls -lh`);
      await RemoteClientSystem.Run(`tree`);
      CloudRunnerLogger.logCli(`${CloudRunnerState.buildParams.branch}`);
      await RemoteClientSystem.Run(`git checkout ${CloudRunnerState.buildParams.branch}`);
      CloudRunnerLogger.logCli(`Checked out ${process.env.GITHUB_SHA}`);
    } catch (error) {
      throw error;
    }
  }

  private static async pullLatestLFS() {
    process.chdir(CloudRunnerState.repoPathFull);
    await RemoteClientSystem.Run(`git lfs pull`);
    CloudRunnerLogger.logCli(`pulled latest LFS files`);
  }
}
