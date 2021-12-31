import fs from 'fs';
import { CloudRunnerState } from '../../cloud-runner/state/cloud-runner-state';
import { Caching } from './caching';
import { LFSHashing } from './lfs-hashing';
import { CloudRunnerAgentSystem } from './cloud-runner-agent-system';
import path from 'path';
import { Input } from '../..';
import { RemoteClientLogger } from './remote-client-logger';

export class SetupCloudRunnerRepository {
  static LFS_ASSETS_HASH;
  public static async run() {
    try {
      await CloudRunnerAgentSystem.Run(`mkdir -p ${CloudRunnerState.buildPathFull}`);
      await CloudRunnerAgentSystem.Run(`mkdir -p ${CloudRunnerState.repoPathFull}`);
      await SetupCloudRunnerRepository.cloneRepoWithoutLFSFiles();

      SetupCloudRunnerRepository.LFS_ASSETS_HASH = await LFSHashing.createLFSHashFiles();

      if (Input.cloudRunnerTests) {
        RemoteClientLogger.log(SetupCloudRunnerRepository.LFS_ASSETS_HASH);
      }
      await LFSHashing.printLFSHashState();
      RemoteClientLogger.log(`Library Caching`);
      if (!fs.existsSync(CloudRunnerState.libraryFolderFull)) {
        RemoteClientLogger.logWarning(`!Warning!: The Unity library was included in the git repository`);
      }
      RemoteClientLogger.log(`LFS Caching`);

      if (Input.cloudRunnerTests) {
        await CloudRunnerAgentSystem.Run(`tree ${path.join(CloudRunnerState.lfsDirectory, '..')}`);
      }
      await Caching.PullFromCache(
        CloudRunnerState.lfsCacheFolder,
        CloudRunnerState.lfsDirectory,
        `${SetupCloudRunnerRepository.LFS_ASSETS_HASH}.zip`,
      );
      if (Input.cloudRunnerTests) {
        await CloudRunnerAgentSystem.Run(`tree ${path.join(CloudRunnerState.lfsDirectory, '..')}`);
      }
      await Caching.printCacheState(CloudRunnerState.lfsCacheFolder, CloudRunnerState.libraryCacheFolder);
      await SetupCloudRunnerRepository.pullLatestLFS();
      await Caching.PushToCache(
        CloudRunnerState.lfsCacheFolder,
        CloudRunnerState.lfsDirectory,
        SetupCloudRunnerRepository.LFS_ASSETS_HASH,
      );

      if (Input.cloudRunnerTests) {
        await CloudRunnerAgentSystem.Run(`tree ${path.join(CloudRunnerState.libraryCacheFolder, '..')}`);
      }
      await Caching.PullFromCache(CloudRunnerState.libraryCacheFolder, CloudRunnerState.libraryFolderFull);

      if (Input.cloudRunnerTests) {
        await CloudRunnerAgentSystem.Run(`tree ${path.join(CloudRunnerState.libraryCacheFolder, '..')}`);
      }

      Caching.handleCachePurging();
    } catch (error) {
      throw error;
    }
  }

  private static async cloneRepoWithoutLFSFiles() {
    try {
      RemoteClientLogger.log(`Initializing source repository for cloning with caching of LFS files`);
      process.chdir(CloudRunnerState.repoPathFull);
      await CloudRunnerAgentSystem.Run(`git config --global advice.detachedHead false`);
      RemoteClientLogger.log(`Cloning the repository being built:`);
      await CloudRunnerAgentSystem.Run(`git lfs install --skip-smudge`);
      await CloudRunnerAgentSystem.Run(
        `git clone ${CloudRunnerState.targetBuildRepoUrl} ${CloudRunnerState.repoPathFull}`,
      );
      if (Input.cloudRunnerTests) {
        await CloudRunnerAgentSystem.Run(`ls -lh`);
        await CloudRunnerAgentSystem.Run(`tree`);
      }
      RemoteClientLogger.log(`${CloudRunnerState.buildParams.branch}`);
      await CloudRunnerAgentSystem.Run(`git checkout ${CloudRunnerState.buildParams.branch}`);
      RemoteClientLogger.log(`Checked out ${process.env.GITHUB_SHA}`);
    } catch (error) {
      throw error;
    }
  }

  private static async pullLatestLFS() {
    process.chdir(CloudRunnerState.repoPathFull);
    await CloudRunnerAgentSystem.Run(`git lfs pull`);
    RemoteClientLogger.log(`pulled latest LFS files`);
  }
}
