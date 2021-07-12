#!/bin/sh

cacheDir=$1
branchName=$2
libDir=$3
purgeRemoteBuilderCache=$4

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

