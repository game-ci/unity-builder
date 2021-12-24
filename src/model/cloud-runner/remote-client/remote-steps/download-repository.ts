import { CloudRunnerState } from '../../state/cloud-runner-state';
import { RunCli } from '../run-cli';

import fs from 'fs';
import CloudRunnerLogger from '../../services/cloud-runner-logger';

export class DownloadRepository {
  public static async run() {
    await RunCli.RunCli(`tree -f -L 2tree -f -L 2`);
    fs.mkdirSync(CloudRunnerState.buildPathFull);
    fs.mkdirSync(CloudRunnerState.repoPathFull);
    CloudRunnerLogger.log(`Initializing source repository for cloning with caching of LFS files`);
    await RunCli.RunCli(`
      cd ${CloudRunnerState.repoPathFull}
      # stop annoying git detatched head info
      git config --global advice.detachedHead false
      echo ' '
      echo "Cloning the repository being built:"
      git lfs install --skip-smudge
      echo "${CloudRunnerState.targetBuildRepoUrl}"
      git clone ${CloudRunnerState.targetBuildRepoUrl} ${CloudRunnerState.repoPathFull}
      git checkout ${process.env.GITHUB_SHA}
      echo "Checked out ${process.env.GITHUB_SHA}"
    `);
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
    await RunCli.RunCli(`
      echo ' '
      echo 'Large File Caching'
      echo "Checking large file cache exists (${lfsCacheFolder}/${LFS_ASSETS_HASH}.zip)"
      cd ${lfsCacheFolder}
      if [ -f "${LFS_ASSETS_HASH}.zip" ]; then
        echo "Match found: using large file hash match ${LFS_ASSETS_HASH}.zip"
        latestLFSCacheFile="${LFS_ASSETS_HASH}"
      else
        latestLFSCacheFile=$(ls -t "${lfsCacheFolder}" | grep .zip$ | head -1)
        echo "Match not found: using latest large file cache $latestLFSCacheFile"
      fi
      if [ ! -f "$latestLFSCacheFile" ]; then
        echo "LFS cache exists from build $latestLFSCacheFile from $branch"
        rm -r "${CloudRunnerState.lfsDirectory}"
        unzip -q "${lfsCacheFolder}/$latestLFSCacheFile" -d "$repoPathFull/.git"
        echo "git LFS folder, (should not contain $latestLFSCacheFile)"
        ls -lh "${CloudRunnerState.lfsDirectory}/"
      fi
      `);
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
    await RunCli.RunCli(`
      cd "${CloudRunnerState.repoPathFull}"
      git lfs pull
      echo 'pulled latest LFS files'
      `);
    await RunCli.RunCli(`
      cd "${CloudRunnerState.lfsDirectory}/.."
      zip -q -r "${LFS_ASSETS_HASH}.zip" "./lfs"
      cp "${LFS_ASSETS_HASH}.zip" "${lfsCacheFolder}"
      echo "copied ${LFS_ASSETS_HASH} to ${lfsCacheFolder}"
      `);
    if (process.env.purgeRemoteCaching !== undefined) {
      CloudRunnerLogger.log(`purging ${CloudRunnerState.purgeRemoteCaching}`);
      fs.rmdirSync(CloudRunnerState.cacheFolder, { recursive: true });
    }
  }
}
