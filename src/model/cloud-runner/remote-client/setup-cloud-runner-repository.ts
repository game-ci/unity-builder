import fs from 'fs';
import CloudRunner from '../cloud-runner';
import { CloudRunnerFolders } from '../services/cloud-runner-folders';
import { Caching } from './caching';
import { LFSHashing } from './lfs-hashing';
import { CloudRunnerSystem } from './cloud-runner-system';
import { RemoteClientLogger } from './remote-client-logger';
import path from 'path';
import { assert } from 'console';
import CloudRunnerLogger from '../services/cloud-runner-logger';
import { CliFunction } from '../../cli/cli-decorator';

export class SetupCloudRunnerRepository {
  public static async run() {
    try {
      await CloudRunnerSystem.Run(`mkdir -p ${CloudRunnerFolders.buildPathFull}`);
      await CloudRunnerSystem.Run(`mkdir -p ${CloudRunnerFolders.repoPathFull}`);
      await CloudRunnerSystem.Run(`mkdir -p ${CloudRunnerFolders.cacheFolderFull}`);
      process.chdir(CloudRunnerFolders.repoPathFull);
      await SetupCloudRunnerRepository.cloneRepoWithoutLFSFiles();
      await SetupCloudRunnerRepository.sizeOfFolder('repo before lfs cache pull', CloudRunnerFolders.repoPathFull);
      const lfsHashes = await LFSHashing.createLFSHashFiles();
      if (fs.existsSync(CloudRunnerFolders.libraryFolderFull)) {
        RemoteClientLogger.logWarning(`!Warning!: The Unity library was included in the git repository`);
      }
      await Caching.PullFromCache(
        CloudRunnerFolders.lfsCacheFolderFull,
        CloudRunnerFolders.lfsDirectoryFull,
        `${lfsHashes.lfsGuidSum}`,
      );
      await SetupCloudRunnerRepository.sizeOfFolder('repo after lfs cache pull', CloudRunnerFolders.repoPathFull);
      await SetupCloudRunnerRepository.pullLatestLFS();
      await SetupCloudRunnerRepository.sizeOfFolder('repo before lfs git pull', CloudRunnerFolders.repoPathFull);
      await Caching.PushToCache(
        CloudRunnerFolders.lfsCacheFolderFull,
        CloudRunnerFolders.lfsDirectoryFull,
        `${lfsHashes.lfsGuidSum}`,
      );
      await Caching.PullFromCache(CloudRunnerFolders.libraryCacheFolderFull, CloudRunnerFolders.libraryFolderFull);
      await SetupCloudRunnerRepository.sizeOfFolder('repo after library cache pull', CloudRunnerFolders.repoPathFull);
      Caching.handleCachePurging();
    } catch (error) {
      throw error;
    }
  }

  private static async sizeOfFolder(message: string, folder: string) {
    CloudRunnerLogger.log(`Size of ${message}`);
    await CloudRunnerSystem.Run(`du -sh ${folder}`);
    await CloudRunnerSystem.Run(`du -h ${folder}`);
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
        `git clone -q ${CloudRunnerFolders.targetBuildRepoUrl} ${path.resolve(
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
    process.chdir(CloudRunnerFolders.repoPathFull);
    await CloudRunnerSystem.Run(`git config --global filter.lfs.smudge "git-lfs smudge -- %f"`);
    await CloudRunnerSystem.Run(`git config --global filter.lfs.process "git-lfs filter-process"`);
    await CloudRunnerSystem.Run(`git lfs pull`);
    RemoteClientLogger.log(`pulled latest LFS files`);
    assert(fs.existsSync(CloudRunnerFolders.lfsDirectoryFull));
  }

  @CliFunction(`remote-cli`, `sets up a repository, usually before a game-ci build`)
  static async runRemoteClientJob() {
    const buildParameter = JSON.parse(process.env.BUILD_PARAMETERS || '{}');
    RemoteClientLogger.log(`Build Params:
      ${JSON.stringify(buildParameter, undefined, 4)}
    `);
    CloudRunner.buildParameters = buildParameter;
    await SetupCloudRunnerRepository.run();
  }
}
