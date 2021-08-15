#!/bin/sh

cacheFolderFull=$1
libraryFolderFull=$2
gitLFSDestinationFolder=$3
purgeRemoteBuilderCache=$4

cacheFolderWithBranch="$cacheFolderFull/$branch"
lfsCacheFolder="$cacheFolderFull/$branch/lfs"
libraryCacheFolder="$cacheFolderFull/$branch/lib"

mkdir -p "$lfsCacheFolder"
mkdir -p "$libraryCacheFolder"

# if the unity git project has included the library delete it and echo a warning
if [ -d "$libraryFolderFull" ]; then
  rm -r "$libraryFolderFull"
  echo "!Warning!: The Unity library was included in the git repository (this isn't usually a good practice)"
fi

# Restore library cache
latestLibraryCacheFile=$(ls -t "$libraryCacheFolder" | grep .zip$ | head -1)

echo "Checking if $libraryCacheFolder/$latestLibraryCacheFile exists from $branch"
if [ -z "$libraryCacheFolder/$latestLibraryCacheFile" ]; then
  echo "Library cache exists"
  mkdir -p "$libraryFolderFull"
  unzip -q "$libraryCacheFolder/$latestLibraryCacheFile" -d "$libraryFolderFull"
fi

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
  mkdir -p "$gitLFSDestinationFolder"
  unzip -q "$lfsCacheFolder/$latestLFSCacheFile" -d "$gitLFSDestinationFolder"
  echo "git LFS folder, (should not contain $latestLFSCacheFile)"
  ls -lh "$gitLFSDestinationFolder"
fi

echo ' '
echo "LFS cache for $branch"
du -sch "$lfsCacheFolder"
ls -lh "$lfsCacheFolder"
echo ' '
echo "Library cache for $branch"
du -sch "$libraryCacheFolder"
ls -lh "$libraryCacheFolder"
echo ' '
echo "Branch: $branch"
du -sch "$cacheFolderWithBranch"
echo ' '
echo 'Full cache'
du -sch "$cacheFolderFull"
echo ' '

ls
cd "$repoPathFull"
git lfs pull
echo 'pulled latest LFS files'
zip -q -r "$LFS_ASSETS_HASH.zip" "$gitLFSDestinationFolder"
cp "$LFS_ASSETS_HASH.zip" "$lfsCacheFolder"
echo "copied $LFS_ASSETS_HASH to $lfsCacheFolder"
echo ' '

# purge cache
if [ "$purgeRemoteBuilderCache" == "true" ]; then
  echo "purging the entire cache"
  rm -r "$cacheFolderFull"
  echo ' '
fi

