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
latestLibraryCacheFile=$(ls -t "$libraryCacheFolder" | egrep -i -e '\\.zip$' | head -1)

if [ ! -z "$latestLibraryCacheFile" ]; then
  echo "Library cache exists from build $latestLibraryCacheFile from $branchName"
  echo 'Creating empty Library folder for cache'
  mkdir "$libraryFolderFull"
  unzip -q "$libraryCacheFolder/$latestLibraryCacheFile" -d "$libraryFolderFull"
fi

# Restore LFS cache
if [ ! -v "$LFS_ASSETS_HASH" ] && [ -f "$LFS_ASSETS_HASH" ]
then latestLFSCacheFile=LFS_ASSETS_HASH
else latestLFSCacheFile=$(ls -t "$cacheFolderWithBranch/lfs" | egrep -i -e '\\.zip$' | head -1)
fi

if [ ! -z "$latestLFSCacheFile" ]; then
  echo "LFS cache exists from build $latestLFSCacheFile from $branchName"
  rm -r "$gitLFSDestinationFolder"
  mkdir -p "$gitLFSDestinationFolder"
  unzip -q "$gitLFSDestinationFolder/$latestLFSCacheFile" -d "$gitLFSDestinationFolder"
fi

echo ' '
du -sch "$gitLFSDestinationFolder"
du -sch "$latestLibraryCacheFile"
echo ' '
du -sch "$cacheFolderWithBranch"
echo ' '
du -sch "$cacheFolderFull"
echo ' '

echo "purge $purgeRemoteBuilderCache"
# purge cache
if [ "$purgeRemoteBuilderCache" == "true" ]; then
  rm -r "$cacheFolderFull"
fi
echo ' '

git lfs pull
zip -r $LFS_ASSETS_HASH -d "$gitLFSDestinationFolder"
cp $LFS_ASSETS_HASH "$lfsCacheFolder"

echo ' '
