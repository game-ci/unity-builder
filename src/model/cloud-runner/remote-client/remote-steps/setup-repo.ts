import { CloudRunnerState } from '../../state/cloud-runner-state';
import { RunCli } from '../run-cli';

import fs from 'fs';
import CloudRunnerLogger from '../../services/cloud-runner-logger';
import path from 'path';

export class DownloadRepository {
  public static async run() {
    fs.mkdirSync(CloudRunnerState.buildPathFull);
    fs.mkdirSync(CloudRunnerState.repoPathFull);
    CloudRunnerLogger.logRemoteCli(`Initializing source repository for cloning with caching of LFS files`);
    process.chdir(CloudRunnerState.repoPathFull);
    // stop annoying git detatched head info
    await RunCli.RunCli(`git config --global advice.detachedHead false`);
    CloudRunnerLogger.logRemoteCli(`Cloning the repository being built:`);
    await RunCli.RunCli(`git lfs install --skip-smudge`);
    CloudRunnerLogger.logRemoteCli(CloudRunnerState.targetBuildRepoUrl);
    await RunCli.RunCli(`
      git clone --progress --verbose ${CloudRunnerState.targetBuildRepoUrl} ${CloudRunnerState.repoPathFull}
    `);
    await RunCli.RunCli(`
      git checkout ${process.env.GITHUB_SHA}
    `);
    CloudRunnerLogger.logRemoteCli(`Checked out ${process.env.GITHUB_SHA}`);
    await RunCli.RunCli(`
      git lfs ls-files -l | cut -d ' ' -f1 | sort > .lfs-assets-guid
    `);
    await RunCli.RunCli(`
      md5sum .lfs-assets-guid > .lfs-assets-guid-sum
    `);
    const LFS_ASSETS_HASH = fs.readFileSync(`${path.join(CloudRunnerState.repoPathFull, `.lfs-assets-guid`)}`, 'utf8');
    await RunCli.RunCli(`
      echo ' '
      echo 'Contents of .lfs-assets-guid file:'
      cat .lfs-assets-guid
      echo ' '
      echo 'Contents of .lfs-assets-guid-sum file:'
      cat .lfs-assets-guid-sum
      echo ' '
      echo 'Source repository initialized'
      ls ${CloudRunnerState.projectPathFull}
      echo ' '
    `);
    const lfsCacheFolder = path.join(CloudRunnerState.cacheFolderFull, `lfs`);
    const libraryCacheFolder = path.join(CloudRunnerState.cacheFolderFull, `lib`);
    await RunCli.RunCli(`tree ${CloudRunnerState.builderPathFull}`);
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
    const latestLibraryCacheFile = await RunCli.RunCli(`ls -t "${libraryCacheFolder}" | grep .zip$ | head -1`);
    await RunCli.RunCli(`ls -lh "${libraryCacheFolder}"`);
    CloudRunnerLogger.logRemoteCli(`Checking if Library cache ${libraryCacheFolder}/${latestLibraryCacheFile} exists`);
    if (fs.existsSync(latestLibraryCacheFile)) {
      CloudRunnerLogger.logRemoteCli(`Library cache exists`);
      await RunCli.RunCli(`
          unzip -q "${path.join(libraryCacheFolder, latestLibraryCacheFile)}" -d "$projectPathFull"
          tree "${CloudRunnerState.libraryFolderFull}"
      `);
    }
    CloudRunnerLogger.logRemoteCli(` `);
    CloudRunnerLogger.logRemoteCli(`LFS Caching`);
    process.chdir(lfsCacheFolder);
    let latestLFSCacheFile;
    if (fs.existsSync(`${LFS_ASSETS_HASH}.zip`)) {
      CloudRunnerLogger.logRemoteCli(`Match found: using large file hash match ${LFS_ASSETS_HASH}.zip`);
      latestLFSCacheFile = `${LFS_ASSETS_HASH}.zip`;
    } else {
      latestLFSCacheFile = await RunCli.RunCli(`ls -t "${lfsCacheFolder}" | grep .zip$ | head -1`);
    }
    if (fs.existsSync(latestLFSCacheFile)) {
      CloudRunnerLogger.logRemoteCli(`LFS cache exists`);
      fs.rmdirSync(CloudRunnerState.lfsDirectory, { recursive: true });
      CloudRunnerLogger.logRemoteCli(`LFS cache exists from build $latestLFSCacheFile from $branch`);
      await RunCli.RunCli(
        `unzip -q "${lfsCacheFolder}/${latestLFSCacheFile}" -d "${path.join(CloudRunnerState.repoPathFull, `.git`)}"`,
      );
      await RunCli.RunCli(`ls -lh "${CloudRunnerState.lfsDirectory}"`);
      CloudRunnerLogger.logRemoteCli(`git LFS folder, (should not contain $latestLFSCacheFile)`);
    }

    await RunCli.RunCli(`
      echo ' '
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
      echo ' '
      `);
    process.chdir(CloudRunnerState.repoPathFull);
    await RunCli.RunCli(`git lfs pull`);
    CloudRunnerLogger.logRemoteCli(`pulled latest LFS files`);
    process.chdir(`${CloudRunnerState.lfsDirectory}/..`);
    await RunCli.RunCli(`zip -r "${LFS_ASSETS_HASH}.zip" "./lfs"`);
    fs.copyFileSync(`${LFS_ASSETS_HASH}.zip`, lfsCacheFolder);
    CloudRunnerLogger.logRemoteCli(`copied ${LFS_ASSETS_HASH} to ${lfsCacheFolder}`);
    if (process.env.purgeRemoteCaching !== undefined) {
      CloudRunnerLogger.logRemoteCli(`purging ${CloudRunnerState.purgeRemoteCaching}`);
      fs.rmdirSync(CloudRunnerState.cacheFolder, { recursive: true });
    }
  }
}
