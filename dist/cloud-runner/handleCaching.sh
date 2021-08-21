#!/bin/sh

cacheFolderFull=$1
libraryFolderFull=$2
gitLFSDestinationFolder=$3
purgeCloudRunnerCache=$4

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
if [ -f "$libraryCacheFolder/$latestLibraryCacheFile" ]; then
  echo "Library cache exists"
  unzip -q "$libraryCacheFolder/$latestLibraryCacheFile" -d "$projectPathFull"
  tree "$libraryFolderFull"
fi

echo ' '

echo 'Large File Caching'

echo "Checking large file cache exists ($lfsCacheFolder/$LFS_ASSETS_HASH.zip)"
if [ -f "$lfsCacheFolder/$LFS_ASSETS_HASH.zip" ]; then
  echo "Match found: using large file hash match $LFS_ASSETS_HASH.zip"
  latestLFSCacheFile="$LFS_ASSETS_HASH"
else
  latestLFSCacheFile=$(ls -t "$lfsCacheFolder" | grep .zip$ | head -1)
  echo "Match not found: using latest large file cache $latestLFSCacheFile"
fi


if [ ! -f "$lfsCacheFolder/$latestLFSCacheFile" ]; then
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
if [ "$purgeCloudRunnerCache" == "true" ]; then
  echo ' '
  echo "purging the entire cache"
  rm -r "$cacheFolderFull"
  echo ' '
fi

