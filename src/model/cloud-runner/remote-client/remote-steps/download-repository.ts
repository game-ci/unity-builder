import { CloudRunnerState } from '../../state/cloud-runner-state';
import { RunCli } from '../run-cli';

import fs from 'fs';
import CloudRunnerLogger from '../../services/cloud-runner-logger';
import { CloudRunner } from '../../..';

export class DownloadRepository {
  public static async run() {
    await RunCli.RunCli(`tree -f -L 2tree -f -L 2`);
    fs.mkdirSync(CloudRunnerState.buildPathFull);
    fs.mkdirSync(CloudRunnerState.repoPathFull);
    CloudRunnerLogger.log(`Initializing source repository for cloning with caching of LFS files`);
    process.chdir(CloudRunnerState.repoPathFull);
    // stop annoying git detatched head info
    await RunCli.RunCli(`git config --global advice.detachedHead false`);
    CloudRunnerLogger.log(`Cloning the repository being built:`);
    await RunCli.RunCli(`git lfs install --skip-smudge`);
    CloudRunnerLogger.log(CloudRunnerState.targetBuildRepoUrl);
    await RunCli.RunCli(`
      git clone ${CloudRunnerState.targetBuildRepoUrl} ${CloudRunnerState.repoPathFull}
      git checkout ${process.env.GITHUB_SHA}
    `);
    CloudRunnerLogger.log(`Checked out ${process.env.GITHUB_SHA}`);
    await RunCli.RunCli(`
      git lfs ls-files -l | cut -d ' ' -f1 | sort > .lfs-assets-guid
      md5sum .lfs-assets-guid > .lfs-assets-guid-sum
    `);
    const LFS_ASSETS_HASH = fs.readFileSync(`${CloudRunnerState.repoPathFull}/.lfs-assets-guid`, 'utf8');
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
    const lfsCacheFolder = `${CloudRunnerState.cacheFolderFull}/lfs`;
    const libraryCacheFolder = `${CloudRunnerState.cacheFolderFull}/lib`;
    await RunCli.RunCli(`tree ${CloudRunnerState.builderPathFull}`);
    CloudRunnerLogger.log(`Starting checks of cache for the Unity project Library and git LFS files`);
    fs.mkdirSync(lfsCacheFolder);
    fs.mkdirSync(libraryCacheFolder);
    CloudRunnerLogger.log(`Library Caching`);
    //if the unity git project has included the library delete it and echo a warning
    if (fs.existsSync(CloudRunnerState.libraryFolderFull)) {
      fs.rmdirSync(CloudRunnerState.libraryFolderFull, { recursive: true });
      CloudRunnerLogger.log(
        `!Warning!: The Unity library was included in the git repository (this isn't usually a good practice)`,
      );
    }
    //Restore library cache
    const latestLibraryCacheFile = await RunCli.RunCli(`ls -t "${libraryCacheFolder}" | grep .zip$ | head -1`);
    await RunCli.RunCli(`ls -lh "${libraryCacheFolder}"`);
    CloudRunnerLogger.log(`Checking if Library cache ${libraryCacheFolder}/${latestLibraryCacheFile} exists`);
    if (fs.existsSync(latestLibraryCacheFile)) {
      CloudRunnerLogger.log(`Library cache exists`);
      await RunCli.RunCli(`
          unzip -q "${libraryCacheFolder}/${latestLibraryCacheFile}" -d "$projectPathFull"
          tree "${CloudRunnerState.libraryFolderFull}"
      `);
    }
    CloudRunnerLogger.log(` `);
    CloudRunnerLogger.log(`LFS Caching`);
    CloudRunnerLogger.log(`Checking largest LFS file exists (${lfsCacheFolder}/${LFS_ASSETS_HASH}.zip)`);
    process.chdir(lfsCacheFolder);
    let latestLFSCacheFile;
    if (fs.existsSync(`${LFS_ASSETS_HASH}.zip`)) {
      CloudRunnerLogger.log(`Match found: using large file hash match ${LFS_ASSETS_HASH}.zip`);
      latestLFSCacheFile = `${LFS_ASSETS_HASH}.zip`;
    } else {
      latestLFSCacheFile = await RunCli.RunCli(`ls -t "${lfsCacheFolder}" | grep .zip$ | head -1`);
    }
    if (fs.existsSync(latestLFSCacheFile)) {
      CloudRunnerLogger.log(`LFS cache exists`);
      fs.rmdirSync(CloudRunnerState.lfsDirectory, { recursive: true });
      CloudRunnerLogger.log(`LFS cache exists from build $latestLFSCacheFile from $branch`);
      await RunCli.RunCli(
        `unzip -q "${lfsCacheFolder}/${latestLFSCacheFile}" -d "${CloudRunnerState.repoPathFull}/.git"`,
      );
      await RunCli.RunCli(`ls -lh "${CloudRunnerState.lfsDirectory}"`);
      CloudRunnerLogger.log(`git LFS folder, (should not contain $latestLFSCacheFile)`);
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
    CloudRunnerLogger.log(`pulled latest LFS files`);
    process.chdir(`${CloudRunnerState.lfsDirectory}/..`);
    await RunCli.RunCli(`zip -q -r "${LFS_ASSETS_HASH}.zip" "./lfs"`);
    fs.copyFileSync(`${LFS_ASSETS_HASH}.zip`, lfsCacheFolder);
    CloudRunnerLogger.log(`copied ${LFS_ASSETS_HASH} to ${lfsCacheFolder}`);
    if (process.env.purgeRemoteCaching !== undefined) {
      CloudRunnerLogger.log(`purging ${CloudRunnerState.purgeRemoteCaching}`);
      fs.rmdirSync(CloudRunnerState.cacheFolder, { recursive: true });
    }
  }
}
