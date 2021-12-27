import fs from 'fs';
import path from 'path';
import CloudRunnerLogger from '../../cloud-runner/services/cloud-runner-logger';
import { CloudRunnerState } from '../../cloud-runner/state/cloud-runner-state';
import { Caching } from './caching';
import { RemoteClientSystem } from './remote-client-system';

export class SetupRemoteRepository {
  static LFS_ASSETS_HASH;
  public static async run() {
    try {
      fs.mkdirSync(CloudRunnerState.buildPathFull);
      fs.mkdirSync(CloudRunnerState.repoPathFull);
      await SetupRemoteRepository.cloneRepoWithoutLFSFiles();

      await SetupRemoteRepository.createLFSHashFiles();
      await SetupRemoteRepository.printLFSHashState();
      const lfsCacheFolder = path.join(CloudRunnerState.cacheFolderFull, `lfs`);
      const libraryCacheFolder = path.join(CloudRunnerState.cacheFolderFull, `lib`);
      await RemoteClientSystem.Run(`tree ${libraryCacheFolder}`);
      await RemoteClientSystem.Run(`tree ${CloudRunnerState.builderPathFull}`);
      await SetupRemoteRepository.libraryCaching(libraryCacheFolder);
      await SetupRemoteRepository.lfsCaching(lfsCacheFolder);

      await SetupRemoteRepository.printCacheState(lfsCacheFolder, libraryCacheFolder);
      await SetupRemoteRepository.pullLatestLFS();
      await SetupRemoteRepository.cacheLatestLFSFiles(lfsCacheFolder);
      SetupRemoteRepository.handleCachePurging();
    } catch (error) {
      throw error;
    }
  }

  private static async printLFSHashState() {
    await RemoteClientSystem.Run(
      `echo ' '
      echo 'Contents of .lfs-assets-guid file:'
      cat .lfs-assets-guid
      echo ' '
      echo 'Contents of .lfs-assets-guid-sum file:'
      cat .lfs-assets-guid-sum
      echo ' '
      echo 'Source repository initialized'
      ls ${CloudRunnerState.projectPathFull}
      echo ' '`,
    );
  }

  private static async printCacheState(lfsCacheFolder: string, libraryCacheFolder: string) {
    await RemoteClientSystem.Run(
      `echo ' '
      echo "LFS cache for $branch"
      du -sch "${lfsCacheFolder}/"
      echo '**'
      echo "Library cache for $branch"
      du -sch "${libraryCacheFolder}/"
      echo '**'
      echo "Branch: $branch"
      du -sch "${CloudRunnerState.cacheFolderFull}/"
      echo '**'
      echo 'Full cache'
      du -sch "${CloudRunnerState.cacheFolderFull}/"
      echo ' '`,
    );
  }

  private static handleCachePurging() {
    if (process.env.purgeRemoteCaching !== undefined) {
      CloudRunnerLogger.logCli(`purging ${CloudRunnerState.purgeRemoteCaching}`);
      fs.rmdirSync(CloudRunnerState.cacheFolder, { recursive: true });
    }
  }

  private static async cacheLatestLFSFiles(lfsCacheFolder: string) {
    await Caching.PushToCache(lfsCacheFolder, CloudRunnerState.lfsDirectory, SetupRemoteRepository.LFS_ASSETS_HASH);
  }

  private static async pullLatestLFS() {
    process.chdir(CloudRunnerState.repoPathFull);
    await RemoteClientSystem.Run(`git lfs pull`);
    CloudRunnerLogger.logCli(`pulled latest LFS files`);
  }

  private static async lfsCaching(lfsCacheFolder: string) {
    CloudRunnerLogger.logCli(`LFS Caching`);
    await Caching.PullFromCache(
      lfsCacheFolder,
      CloudRunnerState.lfsDirectory,
      `${SetupRemoteRepository.LFS_ASSETS_HASH}.zip`,
    );
  }

  private static async libraryCaching(libraryCacheFolder: string) {
    CloudRunnerLogger.logCli(`Library Caching`);
    //if the unity git project has included the library delete it and echo a warning
    if (fs.existsSync(CloudRunnerState.libraryFolderFull)) {
      fs.rmdirSync(CloudRunnerState.libraryFolderFull, { recursive: true });
      CloudRunnerLogger.logCli(`!Warning!: The Unity library was included in the git repository`);
    }
    await Caching.PullFromCache(libraryCacheFolder, CloudRunnerState.libraryFolderFull);
  }

  private static async createLFSHashFiles() {
    await RemoteClientSystem.Run(`git lfs ls-files -l | cut -d ' ' -f1 | sort > .lfs-assets-guid`);
    await RemoteClientSystem.Run(`md5sum .lfs-assets-guid > .lfs-assets-guid-sum`);
    SetupRemoteRepository.LFS_ASSETS_HASH = fs.readFileSync(
      `${path.join(CloudRunnerState.repoPathFull, `.lfs-assets-guid`)}`,
      'utf8',
    );
    CloudRunnerLogger.logCli(SetupRemoteRepository.LFS_ASSETS_HASH);
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
}
