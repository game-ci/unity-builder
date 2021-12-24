import { CloudRunnerState } from '../../state/cloud-runner-state';
import { RunCli } from '../run-cli';

export class DownloadRepository {
  public static async run() {
    await RunCli.RunCli(`
      tree -f -L 2tree -f -L 2
      echo "test"
      mkdir -p ${CloudRunnerState.buildPathFull}
      mkdir -p ${CloudRunnerState.repoPathFull}
      echo ' '
      echo 'Initializing source repository for cloning with caching of LFS files'
      githubSha=$GITHUB_SHA
    `);
    await RunCli.RunCli(`
      cd ${CloudRunnerState.repoPathFull}
      # stop annoying git detatched head info
      git config --global advice.detachedHead false
      echo ' '
      echo "Cloning the repository being built:"
      git lfs install --skip-smudge
      echo "${CloudRunnerState.targetBuildRepoUrl}"
      git clone ${CloudRunnerState.targetBuildRepoUrl} ${CloudRunnerState.repoPathFull}
      git checkout $githubSha
      echo "Checked out $githubSha"
    `);
    await RunCli.RunCli(`
      git lfs ls-files -l | cut -d ' ' -f1 | sort > .lfs-assets-guid
      md5sum .lfs-assets-guid > .lfs-assets-guid-sum
    `);
    await RunCli.RunCli(`
      export LFS_ASSETS_HASH="$(cat ${CloudRunnerState.repoPathFull}/.lfs-assets-guid)"
    `);
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
    await RunCli.RunCli(`
      tree ${CloudRunnerState.builderPathFull}
      echo 'Starting checks of cache for the Unity project Library and git LFS files'
      cacheFolderFull=${CloudRunnerState.cacheFolderFull}
      libraryFolderFull=${CloudRunnerState.libraryFolderFull}
      gitLFSDestinationFolder=${CloudRunnerState.lfsDirectory}
      purgeCloudRunnerCache=${CloudRunnerState.purgeRemoteCaching}
      cacheFolderWithBranch="$cacheFolderFull"
      lfsCacheFolder="$cacheFolderFull/lfs"
      libraryCacheFolder="$cacheFolderFull/lib"
      mkdir -p "$lfsCacheFolder"
      mkdir -p "$libraryCacheFolder"
      echo 'Library Caching'
      # if the unity git project has included the library delete it and echo a warning
      if [ -d "$libraryFolderFull" ]; then
        rm -r "$libraryFolderFull"
        echo "!Warning!: The Unity library was included in the git repository (this isn't usually a good practice)"
      fi
      # Restore library cache
      ls -lh "$libraryCacheFolder"
      latestLibraryCacheFile=$(ls -t "$libraryCacheFolder" | grep .zip$ | head -1)
      echo "Checking if Library cache $libraryCacheFolder/$latestLibraryCacheFile exists"
      cd $libraryCacheFolder
      if [ -f "$latestLibraryCacheFile" ]; then
        echo "Library cache exists"
        unzip -q "$libraryCacheFolder/$latestLibraryCacheFile" -d "$projectPathFull"
        tree "$libraryFolderFull"
      fi
      echo ' '
      echo 'Large File Caching'
      echo "Checking large file cache exists ($lfsCacheFolder/$LFS_ASSETS_HASH.zip)"
      cd $lfsCacheFolder
      if [ -f "$LFS_ASSETS_HASH.zip" ]; then
        echo "Match found: using large file hash match $LFS_ASSETS_HASH.zip"
        latestLFSCacheFile="$LFS_ASSETS_HASH"
      else
        latestLFSCacheFile=$(ls -t "$lfsCacheFolder" | grep .zip$ | head -1)
        echo "Match not found: using latest large file cache $latestLFSCacheFile"
      fi
      if [ ! -f "$latestLFSCacheFile" ]; then
        echo "LFS cache exists from build $latestLFSCacheFile from $branch"
        rm -r "$gitLFSDestinationFolder"
        unzip -q "$lfsCacheFolder/$latestLFSCacheFile" -d "$repoPathFull/.git"
        echo "git LFS folder, (should not contain $latestLFSCacheFile)"
        ls -lh "$gitLFSDestinationFolder/"
      fi
      echo ' '
      echo "LFS cache for $branch"
      du -sch "$lfsCacheFolder/"
      echo '**'
      echo "Library cache for $branch"
      du -sch "$libraryCacheFolder/"
      echo '**'
      echo "Branch: $branch"
      du -sch "$cacheFolderWithBranch/"
      echo '**'
      echo 'Full cache'
      du -sch "$cacheFolderFull/"
      echo ' '
      cd "$repoPathFull"
      git lfs pull
      echo 'pulled latest LFS files'
      cd "$gitLFSDestinationFolder/.."
      zip -q -r "$LFS_ASSETS_HASH.zip" "./lfs"
      cp "$LFS_ASSETS_HASH.zip" "$lfsCacheFolder"
      echo "copied $LFS_ASSETS_HASH to $lfsCacheFolder"
      # purge cache
      if [ -z "$purgeCloudRunnerCache" ]; then
        echo ' '
        echo "purging $purgeCloudRunnerCache"
        rm -r "$purgeCloudRunnerCache"
        echo ' '
      fi
    `);
  }
}
