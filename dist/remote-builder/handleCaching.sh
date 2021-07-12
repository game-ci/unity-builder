#!/bin/sh

branchName=$1
libDir=$2
purgeRemoteBuilderCache=$3

echo "Checking cache"

# Restore cache
latest=$(ls -t | head -1)
if [ ! -z "$latest" ]; then
  echo "Library cache exists from build $latest from $branchName"
  echo 'Creating empty Library folder for cache'
  mkdir $libDir
  unzip -q $latest -d $libDir
else
  echo 'Cache does not exist'
fi

# purge cache
if [ "$purgeRemoteBuilderCache" == "true" ]; then
  rm -r $libDir
fi

