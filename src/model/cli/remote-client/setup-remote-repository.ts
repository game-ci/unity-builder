import fs from 'fs';
import path from 'path';
import CloudRunnerLogger from '../../cloud-runner/services/cloud-runner-logger';
import { CloudRunnerState } from '../../cloud-runner/state/cloud-runner-state';
import { RemoteClientSystem } from './remote-client-system';

export class SetupRemoteRepository {
  public static async run() {
    try {
      fs.mkdirSync(CloudRunnerState.buildPathFull);
      fs.mkdirSync(CloudRunnerState.repoPathFull);
      await SetupRemoteRepository.cloneRepoWithoutLFSFiles();

      await SetupRemoteRepository.createLFSHashFiles();
      const LFS_ASSETS_HASH = fs.readFileSync(
        `${path.join(CloudRunnerState.repoPathFull, `.lfs-assets-guid`)}`,
        'utf8',
      );
      await SetupRemoteRepository.printLFSHashState();
      const lfsCacheFolder = path.join(CloudRunnerState.cacheFolderFull, `lfs`);
      const libraryCacheFolder = path.join(CloudRunnerState.cacheFolderFull, `lib`);
      await RemoteClientSystem.Run(`tree ${CloudRunnerState.builderPathFull}`);
      await SetupRemoteRepository.libraryCaching(lfsCacheFolder, libraryCacheFolder);
      await SetupRemoteRepository.lfsCaching(lfsCacheFolder, LFS_ASSETS_HASH);

      await SetupRemoteRepository.printCacheState(lfsCacheFolder, libraryCacheFolder);
      await SetupRemoteRepository.pullLatestLFS();
      await SetupRemoteRepository.cacheLatestLFSFiles(LFS_ASSETS_HASH, lfsCacheFolder);
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
      CloudRunnerLogger.logRemoteCli(`purging ${CloudRunnerState.purgeRemoteCaching}`);
      fs.rmdirSync(CloudRunnerState.cacheFolder, { recursive: true });
    }
  }

  private static async cacheLatestLFSFiles(LFS_ASSETS_HASH: string, lfsCacheFolder: string) {
    process.chdir(`${CloudRunnerState.lfsDirectory}/..`);
    await RemoteClientSystem.Run(`zip -r "${LFS_ASSETS_HASH}.zip" "./lfs"`);
    fs.copyFileSync(`${LFS_ASSETS_HASH}.zip`, lfsCacheFolder);
    CloudRunnerLogger.logRemoteCli(`copied ${LFS_ASSETS_HASH} to ${lfsCacheFolder}`);
  }

  private static async pullLatestLFS() {
    process.chdir(CloudRunnerState.repoPathFull);
    await RemoteClientSystem.Run(`git lfs pull`);
    CloudRunnerLogger.logRemoteCli(`pulled latest LFS files`);
  }

  private static async lfsCaching(lfsCacheFolder: string, LFS_ASSETS_HASH: string) {
    CloudRunnerLogger.logRemoteCli(` `);
    CloudRunnerLogger.logRemoteCli(`LFS Caching`);
    process.chdir(lfsCacheFolder);
    let latestLFSCacheFile;
    if (fs.existsSync(`${LFS_ASSETS_HASH}.zip`)) {
      CloudRunnerLogger.logRemoteCli(`Match found: using large file hash match ${LFS_ASSETS_HASH}.zip`);
      latestLFSCacheFile = `${LFS_ASSETS_HASH}.zip`;
    } else {
      latestLFSCacheFile = await RemoteClientSystem.Run(`ls -t "${lfsCacheFolder}" | grep .zip$ | head -1`);
    }
    if (fs.existsSync(latestLFSCacheFile)) {
      CloudRunnerLogger.logRemoteCli(`LFS cache exists`);
      fs.rmdirSync(CloudRunnerState.lfsDirectory, { recursive: true });
      CloudRunnerLogger.logRemoteCli(`LFS cache exists from build $latestLFSCacheFile from $branch`);
      await RemoteClientSystem.Run(
        `unzip -q "${lfsCacheFolder}/${latestLFSCacheFile}" -d "${path.join(CloudRunnerState.repoPathFull, `.git`)}"`,
      );
      await RemoteClientSystem.Run(`ls -lh "${CloudRunnerState.lfsDirectory}"`);
      CloudRunnerLogger.logRemoteCli(`git LFS folder, (should not contain $latestLFSCacheFile)`);
    }
  }

  private static async libraryCaching(lfsCacheFolder: string, libraryCacheFolder: string) {
    CloudRunnerLogger.logRemoteCli(`Starting checks of cache for the Unity project Library and git LFS files`);
    if (!fs.existsSync(lfsCacheFolder)) {
      fs.mkdirSync(lfsCacheFolder);
    }
    if (!fs.existsSync(libraryCacheFolder)) {
      fs.mkdirSync(libraryCacheFolder);
    }
    CloudRunnerLogger.logRemoteCli(`Library Caching`);
    //if the unity git project has included the library delete it and echo a warning
    if (fs.existsSync(CloudRunnerState.libraryFolderFull)) {
      fs.rmdirSync(CloudRunnerState.libraryFolderFull, { recursive: true });
      CloudRunnerLogger.logRemoteCli(
        `!Warning!: The Unity library was included in the git repository (this isn't usually a good practice)`,
      );
    }
    //Restore library cache
    const latestLibraryCacheFile = await RemoteClientSystem.Run(`ls -t "${libraryCacheFolder}" | grep .zip$ | head -1`);
    await RemoteClientSystem.Run(`ls -lh "${libraryCacheFolder}"`);
    CloudRunnerLogger.logRemoteCli(`Checking if Library cache ${libraryCacheFolder}/${latestLibraryCacheFile} exists`);
    if (fs.existsSync(latestLibraryCacheFile)) {
      CloudRunnerLogger.logRemoteCli(`Library cache exists`);
      const latestCacheFilePath = path.join(libraryCacheFolder, latestLibraryCacheFile);
      await RemoteClientSystem.Run(`unzip -q "${latestCacheFilePath}" -d "$projectPathFull"`);
    }
  }

  private static async createLFSHashFiles() {
    await RemoteClientSystem.Run(`git lfs ls-files -l | cut -d ' ' -f1 | sort > .lfs-assets-guid`);
    await RemoteClientSystem.Run(`md5sum .lfs-assets-guid > .lfs-assets-guid-sum`);
  }

  private static async cloneRepoWithoutLFSFiles() {
    try {
      CloudRunnerLogger.logRemoteCli(`Initializing source repository for cloning with caching of LFS files`);
      process.chdir(CloudRunnerState.repoPathFull);
      await RemoteClientSystem.Run(`git config --global advice.detachedHead false`);
      CloudRunnerLogger.logRemoteCli(`Cloning the repository being built:`);
      await RemoteClientSystem.Run(`git lfs install --skip-smudge`);
      CloudRunnerLogger.logRemoteCli(CloudRunnerState.targetBuildRepoUrl);
      await RemoteClientSystem.Run(
        `git clone --depth 1 ${CloudRunnerState.targetBuildRepoUrl} ${CloudRunnerState.repoPathFull}`,
      );
      await RemoteClientSystem.Run(`ls -lh`);
      await RemoteClientSystem.Run(`tree`);
      await RemoteClientSystem.Run(`${CloudRunnerState.buildParams.gitSha}`);
      await RemoteClientSystem.Run(`git checkout ${CloudRunnerState.buildParams.gitSha}`);
      CloudRunnerLogger.logRemoteCli(`Checked out ${process.env.GITHUB_SHA}`);
    } catch (error) {
      throw error;
    }
  }
}
