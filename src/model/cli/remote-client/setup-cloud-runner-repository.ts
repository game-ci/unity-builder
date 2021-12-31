import fs from 'fs';
import { CloudRunnerState } from '../../cloud-runner/state/cloud-runner-state';
import { Caching } from './caching';
import { LFSHashing } from './lfs-hashing';
import { CloudRunnerAgentSystem } from './cloud-runner-agent-system';
import { Input } from '../..';
import { RemoteClientLogger } from './remote-client-logger';

export class SetupCloudRunnerRepository {
  public static async run() {
    try {
      await CloudRunnerAgentSystem.Run(`mkdir -p ${CloudRunnerState.buildPathFull}`);
      await CloudRunnerAgentSystem.Run(`mkdir -p ${CloudRunnerState.repoPathFull}`);
      await SetupCloudRunnerRepository.cloneRepoWithoutLFSFiles();
      const lfsHashes = await LFSHashing.createLFSHashFiles();
      if (!fs.existsSync(CloudRunnerState.libraryFolderFull)) {
        RemoteClientLogger.logWarning(`!Warning!: The Unity library was included in the git repository`);
      }
      await Caching.PullFromCache(
        CloudRunnerState.lfsCacheFolderFull,
        CloudRunnerState.lfsDirectory,
        `${lfsHashes.lfsGuid}.zip`,
      );
      await SetupCloudRunnerRepository.pullLatestLFS();
      await Caching.PushToCache(CloudRunnerState.lfsCacheFolderFull, CloudRunnerState.lfsDirectory, lfsHashes.lfsGuid);
      await Caching.PullFromCache(CloudRunnerState.libraryCacheFolderFull, CloudRunnerState.libraryFolderFull);

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
