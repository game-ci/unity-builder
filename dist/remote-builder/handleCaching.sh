#!/bin/sh

cacheFolderFull=$1
branchName=$2
libraryFolderFull=$3
gitLFSDestinationFolder=$4
purgeRemoteBuilderCache=$5

cacheFolderWithBranch="$cacheFolderFull/$branchName"

echo " "

mkdir -p "$cacheFolderWithBranch/lib"
mkdir -p "$cacheFolderWithBranch/lfs"

echo "Library cache for branch: $branchName"
ls -lh "$cacheFolderWithBranch"
ls -lh "$cacheFolderWithBranch/lib"
ls -lh "$cacheFolderWithBranch/lfs"
echo ''

if [ -d "$libraryFolderFull" ]; then
  rm -r "$libraryFolderFull"
  echo "Git must ignore the Library folder"
fi

echo "Checking cache"

# Restore library cache
latest=$(ls -t "$cacheFolderWithBranch/lib" | egrep -i -e '\\.zip$' | head -1)

if [ ! -z "$latest" ]; then
  echo "Library cache exists from build $latest from $branchName"
  echo 'Creating empty Library folder for cache'
  mkdir "$libraryFolderFull"
  unzip -q "$cacheFolderWithBranch/lib/$latest" -d "$libraryFolderFull"
fi

# Restore LFS cache
latest=$(ls -t "$cacheFolderWithBranch/lfs" | egrep -i -e '\\.zip$' | head -1)

if [ ! -z "$latest" ]; then
  echo "Library cache exists from build $latest from $branchName"
  echo 'Creating empty Library folder for cache'
  mkdir "$libraryFolderFull"
  unzip -q "$cacheFolderWithBranch/lfs/$latest" -d "$gitLFSDestinationFolder"
fi

# purge cache
if [ "$purgeRemoteBuilderCache" == "true" ]; then
  rm -r "$cacheFolderFull"
fi
