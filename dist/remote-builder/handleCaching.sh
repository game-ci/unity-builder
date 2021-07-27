#!/bin/sh

cacheDir=$1
branchName=$2
libDir=$3
purgeRemoteBuilderCache=$4

# handle library cache
if [ ! -d $cacheFolderFull ]; then
  mkdir $cacheFolderFull
  echo "creating new cache folder"
fi
if [ ! -d $cacheFolderFull/$branchName ]; then
  mkdir $cacheFolderFull/$branchName
  echo "creating new cache branch folder for: ${branchName}"
fi

echo "Library cache for branch: $branchName"
ls $cacheFolderFull/$branchName
echo ''

if [ -d $libraryFolderFull ]; then
  rm -r $libraryFolderFull
  echo "Git must ignore the Library folder"
fi


echo "Checking cache"

# Restore library cache
latest=$(ls -t $cacheDir | head -1)
if [ ! -z "$latest" ]; then
  echo "Library cache exists from build $latest from $branchName"
  echo 'Creating empty Library folder for cache'
  mkdir $libDir
  unzip -q $latest -d $libDir
else
  echo 'Cache does not exist'
fi

# Restore LFS cache

# purge cache
if [ "$purgeRemoteBuilderCache" == "true" ]; then
  rm -r $libDir
fi

