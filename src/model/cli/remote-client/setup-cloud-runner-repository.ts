import fs from 'fs';
import { CloudRunnerState } from '../../cloud-runner/state/cloud-runner-state';
import { Caching } from './remote-client-services/caching';
import { LFSHashing } from './remote-client-services/lfs-hashing';
import { CloudRunnerSystem } from './remote-client-services/cloud-runner-system';
import { Input } from '../..';
import { RemoteClientLogger } from './remote-client-services/remote-client-logger';
import path from 'path';
import { assert } from 'console';

export class SetupCloudRunnerRepository {
  public static async run() {
    try {
      await CloudRunnerSystem.Run(`mkdir -p ${CloudRunnerState.buildPathFull}`);
      await CloudRunnerSystem.Run(`mkdir -p ${CloudRunnerState.repoPathFull}`);
      await SetupCloudRunnerRepository.cloneRepoWithoutLFSFiles();
      const lfsHashes = await LFSHashing.createLFSHashFiles();
      if (fs.existsSync(CloudRunnerState.libraryFolderFull)) {
        RemoteClientLogger.logWarning(`!Warning!: The Unity library was included in the git repository`);
      }
      await Caching.PullFromCache(
        CloudRunnerState.lfsCacheFolderFull,
        CloudRunnerState.lfsDirectoryFull,
        `${lfsHashes.lfsGuid}`,
      );
      await SetupCloudRunnerRepository.pullLatestLFS();
      await Caching.PushToCache(
        CloudRunnerState.lfsCacheFolderFull,
        CloudRunnerState.lfsDirectoryFull,
        `${lfsHashes.lfsGuid}`,
      );
      await Caching.PullFromCache(CloudRunnerState.libraryCacheFolderFull, CloudRunnerState.libraryFolderFull);

      Caching.handleCachePurging();
    } catch (error) {
      throw error;
    }
  }

  private static async cloneRepoWithoutLFSFiles() {
    try {
      RemoteClientLogger.log(`Initializing source repository for cloning with caching of LFS files`);
      await CloudRunnerSystem.Run(`git config --global advice.detachedHead false`);
      RemoteClientLogger.log(`Cloning the repository being built:`);
      await CloudRunnerSystem.Run(`git lfs install --skip-smudge`);
      await CloudRunnerSystem.Run(
        `git clone ${CloudRunnerState.targetBuildRepoUrl} ./../${path.basename(CloudRunnerState.repoPathFull)}`,
      );
      process.chdir(`${CloudRunnerState.repoPathFull}`);
      assert(fs.existsSync(`.git`));
      if (Input.cloudRunnerTests) {
        await CloudRunnerSystem.Run(`ls -lh`);
        await CloudRunnerSystem.Run(`tree`);
      }
      RemoteClientLogger.log(`${CloudRunnerState.buildParams.branch}`);
      await CloudRunnerSystem.Run(`git checkout ${CloudRunnerState.buildParams.branch}`);
      RemoteClientLogger.log(`Checked out ${process.env.GITHUB_SHA}`);
    } catch (error) {
      throw error;
    }
  }

  private static async pullLatestLFS() {
    await CloudRunnerSystem.Run(`ls -lh ${CloudRunnerState.lfsDirectoryFull}/..`);
    process.chdir(CloudRunnerState.repoPathFull);
    await CloudRunnerSystem.Run(`git lfs pull`);
    RemoteClientLogger.log(`pulled latest LFS files`);
    assert(fs.existsSync(CloudRunnerState.lfsDirectoryFull));
    await CloudRunnerSystem.Run(`ls -lh ${CloudRunnerState.lfsDirectoryFull}/..`);
  }
}
