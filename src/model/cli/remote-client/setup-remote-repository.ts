import fs from 'fs';
import path from 'path';
import CloudRunnerLogger from '../../cloud-runner/services/cloud-runner-logger';
import { CloudRunnerState } from '../../cloud-runner/state/cloud-runner-state';
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
    process.chdir(`${CloudRunnerState.lfsDirectory}/..`);
    await RemoteClientSystem.Run(`zip -r "${SetupRemoteRepository.LFS_ASSETS_HASH}.zip" "lfs"`);
    CloudRunnerLogger.logCli(fs.existsSync(`${SetupRemoteRepository.LFS_ASSETS_HASH}.zip`).toString());
    await RemoteClientSystem.Run(
      `cp "${SetupRemoteRepository.LFS_ASSETS_HASH}.zip" "${path.join(
        lfsCacheFolder,
        `${SetupRemoteRepository.LFS_ASSETS_HASH}.zip`,
      )}"`,
    );
    CloudRunnerLogger.logCli(`copied ${SetupRemoteRepository.LFS_ASSETS_HASH} to ${lfsCacheFolder}`);
  }

  private static async pullLatestLFS() {
    process.chdir(CloudRunnerState.repoPathFull);
    await RemoteClientSystem.Run(`git lfs pull`);
    CloudRunnerLogger.logCli(`pulled latest LFS files`);
  }

  private static async lfsCaching(lfsCacheFolder: string) {
    CloudRunnerLogger.logCli(`LFS Caching`);
    if (!fs.existsSync(lfsCacheFolder)) {
      fs.mkdirSync(lfsCacheFolder);
    }
    process.chdir(lfsCacheFolder);
    let latestLFSCacheFile;
    if (fs.existsSync(`${SetupRemoteRepository.LFS_ASSETS_HASH}.zip`)) {
      CloudRunnerLogger.logCli(`Match found: using large file hash match ${SetupRemoteRepository.LFS_ASSETS_HASH}.zip`);
      latestLFSCacheFile = `${SetupRemoteRepository.LFS_ASSETS_HASH}.zip`;
    } else {
      latestLFSCacheFile = await RemoteClientSystem.Run(`ls -t "${lfsCacheFolder}" | grep .zip$ | head -1`);
    }
    if (fs.existsSync(latestLFSCacheFile)) {
      CloudRunnerLogger.logCli(`LFS cache exists`);
      fs.rmdirSync(CloudRunnerState.lfsDirectory, { recursive: true });
      CloudRunnerLogger.logCli(
        `LFS cache exists from build ${latestLFSCacheFile} from ${CloudRunnerState.buildParams.branch}`,
      );
      await RemoteClientSystem.Run(
        `unzip -q "${lfsCacheFolder}/${latestLFSCacheFile}" -d "${path.join(CloudRunnerState.repoPathFull, `.git`)}"`,
      );
      CloudRunnerLogger.logCli(`git LFS folder, (should not contain $latestLFSCacheFile)`);
    }
  }

  private static async libraryCaching(libraryCacheFolder: string) {
    CloudRunnerLogger.logCli(`Library Caching`);
    //if the unity git project has included the library delete it and echo a warning
    if (fs.existsSync(CloudRunnerState.libraryFolderFull)) {
      fs.rmdirSync(CloudRunnerState.libraryFolderFull, { recursive: true });
      CloudRunnerLogger.logCli(`!Warning!: The Unity library was included in the git repository`);
    }
    if (!fs.existsSync(libraryCacheFolder)) {
      fs.mkdirSync(libraryCacheFolder);
    }
    //Restore library cache
    const latestLibraryCacheFile = await (
      await RemoteClientSystem.Run(`ls -t "${libraryCacheFolder}" | grep .zip$ | head -1`)
    ).replace(`\n`, ``);
    CloudRunnerLogger.logCli(`Checking if Library cache ${libraryCacheFolder}/${latestLibraryCacheFile} exists`);
    process.chdir(libraryCacheFolder);
    if (fs.existsSync(latestLibraryCacheFile)) {
      CloudRunnerLogger.logCli(`Library cache exists`);
      await RemoteClientSystem.Run(`unzip "${latestLibraryCacheFile}" -d "${CloudRunnerState.libraryFolderFull}"`);
    } else {
      CloudRunnerLogger.logCli(`Library cache doesn't exist`);
      if (latestLibraryCacheFile !== ``) {
        throw new Error(`Failed to get library cache, but cache hit was found (${latestLibraryCacheFile})`);
      }
    }
  }
  static checkFileExists(filepath) {
    return new Promise((resolve) => {
      fs.access(filepath, fs.constants.F_OK, (error) => {
        resolve(!error);
      });
    });
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
