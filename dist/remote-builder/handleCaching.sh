#!/bin/sh

cacheFolderFull=$1
branchName=$2
libraryFolderFull=$3
gitLFSDestinationFolder=$4
purgeRemoteBuilderCache=$5

cacheFolderWithBranch="$cacheFolderFull/$branchName"
lfsCacheFolder="$cacheFolderFull/$branchName/lfs"
libraryCacheFolder="$cacheFolderFull/$branchName/lib"

echo ' '

echo "LFS cache for branch: $branchName"
mkdir -p "$lfsCacheFolder"
ls -lh "$lfsCacheFolder"

echo ' '

echo "Library cache for branch: $branchName"
mkdir -p "$libraryCacheFolder"
ls -lh "$libraryCacheFolder"

echo ' '

# if the unity git project has included the library delete it and echo a warning
if [ -d "$libraryFolderFull" ]; then
  rm -r "$libraryFolderFull"
  echo "!Warning!: The Unity library was included in the git repository (this isn't usually a good practice)"
fi

echo "Checking cache"

# Restore library cache
latestLibraryCacheFile=$(ls -t "$libraryCacheFolder" | grep .zip$ | head -1)

if [ ! -z "$latestLibraryCacheFile" ]; then
  echo "Library cache exists from build $latestLibraryCacheFile from $branchName"
  echo 'Creating empty Library folder for cache'
  mkdir -p "$libraryFolderFull"
  unzip -q "$libraryCacheFolder/$latestLibraryCacheFile" -d "$libraryFolderFull"
  echo 'Unzipped library'
fi

echo "Checking cache for a cache match based on the combined large files hash ($lfsCacheFolder/$LFS_ASSETS_HASH.zip)"

if [ ! -v "$LFS_ASSETS_HASH" ] && [ -f "$lfsCacheFolder/$LFS_ASSETS_HASH.zip" ]; then
  echo "Match found: using large file hash match $LFS_ASSETS_HASH.zip"
  latestLFSCacheFile="$LFS_ASSETS_HASH.zip"
else
  echo "d1"
  latestLFSCacheFile=$(ls -t "$lfsCacheFolder" | grep .zip$ | head -1)
  echo "Match not found: using latest large file cache $latestLFSCacheFile"
fi


if [ ! -f "$lfsCacheFolder/$latestLFSCacheFile" ]; then
  echo "LFS cache exists from build $latestLFSCacheFile from $branchName"
  echo "$gitLFSDestinationFolder"
  rm -r "$gitLFSDestinationFolder"
  echo "$gitLFSDestinationFolder"
  mkdir -p "$gitLFSDestinationFolder"
  echo "$lfsCacheFolder/$latestLFSCacheFile"
  echo "$gitLFSDestinationFolder"
  unzip -q "$lfsCacheFolder/$latestLFSCacheFile" -d "$gitLFSDestinationFolder"
fi

echo ' '
echo 'Size of LFS cache folder for this branch'
du -sch "$gitLFSDestinationFolder"
echo 'Size of Library cache folder for this branch'
du -sch "$latestLibraryCacheFolder"
echo ' '

echo 'Size of cache folder for this branch'
du -sch "$cacheFolderWithBranch"
echo ' '

echo 'Size of LFS cache folder'
du -sch "$cacheFolderFull"
echo ' '

# purge cache
if [ "$purgeRemoteBuilderCache" == "true" ]; then
  echo "purging the entire cache"
  rm -r "$cacheFolderFull"
  echo ' '
fi

git lfs pull
zip -r "$LFS_ASSETS_HASH" -d "$gitLFSDestinationFolder"
cp "$LFS_ASSETS_HASH" "$lfsCacheFolder"

echo ' '
