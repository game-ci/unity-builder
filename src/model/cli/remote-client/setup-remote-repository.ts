import fs from 'fs';
import path from 'path';
import CloudRunnerLogger from '../../cloud-runner/services/cloud-runner-logger';
import { CloudRunnerState } from '../../cloud-runner/state/cloud-runner-state';
import { CloudRunnerAgentSystem } from './cloud-runner-agent-system';

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
      await CloudRunnerAgentSystem.Run(`tree ${libraryCacheFolder}`);
      await CloudRunnerAgentSystem.Run(`tree ${CloudRunnerState.builderPathFull}`);
      await SetupRemoteRepository.libraryCaching(lfsCacheFolder, libraryCacheFolder);
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
    await CloudRunnerAgentSystem.Run(
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
    await CloudRunnerAgentSystem.Run(
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
    await CloudRunnerAgentSystem.Run(`zip -r "${SetupRemoteRepository.LFS_ASSETS_HASH}.zip" "lfs"`);
    CloudRunnerLogger.logCli(fs.existsSync(`${SetupRemoteRepository.LFS_ASSETS_HASH}.zip`).toString());
    await CloudRunnerAgentSystem.Run(
      `cp "${SetupRemoteRepository.LFS_ASSETS_HASH}.zip" "${path.join(
        lfsCacheFolder,
        `${SetupRemoteRepository.LFS_ASSETS_HASH}.zip`,
      )}"`,
    );
    CloudRunnerLogger.logCli(`copied ${SetupRemoteRepository.LFS_ASSETS_HASH} to ${lfsCacheFolder}`);
  }

  private static async pullLatestLFS() {
    process.chdir(CloudRunnerState.repoPathFull);
    await CloudRunnerAgentSystem.Run(`git lfs pull`);
    CloudRunnerLogger.logCli(`pulled latest LFS files`);
  }

  private static async lfsCaching(lfsCacheFolder: string) {
    CloudRunnerLogger.logCli(` `);
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
      latestLFSCacheFile = await CloudRunnerAgentSystem.Run(`ls -t "${lfsCacheFolder}" | grep .zip$ | head -1`);
    }
    if (fs.existsSync(latestLFSCacheFile)) {
      CloudRunnerLogger.logCli(`LFS cache exists`);
      fs.rmdirSync(CloudRunnerState.lfsDirectory, { recursive: true });
      CloudRunnerLogger.logCli(
        `LFS cache exists from build ${latestLFSCacheFile} from ${CloudRunnerState.buildParams.branch}`,
      );
      await CloudRunnerAgentSystem.Run(
        `unzip -q "${lfsCacheFolder}/${latestLFSCacheFile}" -d "${path.join(CloudRunnerState.repoPathFull, `.git`)}"`,
      );
      CloudRunnerLogger.logCli(`git LFS folder, (should not contain $latestLFSCacheFile)`);
    }
  }

  private static async libraryCaching(lfsCacheFolder: string, libraryCacheFolder: string) {
    CloudRunnerLogger.logCli(`Starting checks of cache for the Unity project Library and git LFS files`);
    if (!fs.existsSync(libraryCacheFolder)) {
      fs.mkdirSync(libraryCacheFolder);
    }
    CloudRunnerLogger.logCli(`Library Caching`);
    //if the unity git project has included the library delete it and echo a warning
    if (fs.existsSync(CloudRunnerState.libraryFolderFull)) {
      fs.rmdirSync(CloudRunnerState.libraryFolderFull, { recursive: true });
      CloudRunnerLogger.logCli(
        `!Warning!: The Unity library was included in the git repository (this isn't usually a good practice)`,
      );
    }
    //Restore library cache
    const latestLibraryCacheFile = await CloudRunnerAgentSystem.Run(
      `ls -t "${libraryCacheFolder}" | grep .zip$ | head -1`,
    );
    await CloudRunnerAgentSystem.Run(`ls -lh "${libraryCacheFolder}"`);
    CloudRunnerLogger.logCli(`Checking if Library cache ${libraryCacheFolder}/${latestLibraryCacheFile} exists`);
    if (fs.existsSync(latestLibraryCacheFile)) {
      CloudRunnerLogger.logCli(`Library cache exists`);
      const latestCacheFilePath = path.join(libraryCacheFolder, latestLibraryCacheFile);
      await CloudRunnerAgentSystem.Run(`unzip -q "${latestCacheFilePath}" -d "$projectPathFull"`);
    }
  }

  private static async createLFSHashFiles() {
    await CloudRunnerAgentSystem.Run(`git lfs ls-files -l | cut -d ' ' -f1 | sort > .lfs-assets-guid`);
    await CloudRunnerAgentSystem.Run(`md5sum .lfs-assets-guid > .lfs-assets-guid-sum`);
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
}
