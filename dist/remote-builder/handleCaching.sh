#!/bin/sh

cacheFolderFull=$1
branchName=$2
libraryFolderFull=$3
purgeRemoteBuilderCache=$4

echo " "
echo "Caching starting, parameters:"
echo "$cacheFolderFull"
echo "$branchName"
echo "$libraryFolderFull"
echo "$purgeRemoteBuilderCache"

echo " "
# handle library cache
if [ ! -d "$cacheFolderFull" ]; then
  echo "creating new cache folder $cacheFolderFull"
  mkdir "$cacheFolderFull"
  if [ ! -d "$cacheFolderFull/$branchName" ]; then
    echo "creating new cache branch folder for: $cacheFolderFull/$branchName"
    mkdir "$cacheFolderFull/$branchName"
  else
    echo "cache branch folder already exists for: $cacheFolderFull/$branchName"
  fi
else
  echo "cache folder already exists $cacheFolderFull"
fi

echo "Library cache for branch: $branchName"
ls "$cacheFolderFull/$branchName"
echo ''

if [ -d "$libraryFolderFull" ]; then
  rm -r "$libraryFolderFull"
  echo "Git must ignore the Library folder"
fi


echo "Checking cache"

# Restore library cache
latest=$(ls -t "$cacheFolderFull/$branchName" | head -1)
if [ ! -z "$latest" ]; then
  echo "Library cache exists from build $latest from $branchName"
  echo 'Creating empty Library folder for cache'
  mkdir "$libraryFolderFull"
  unzip -q "$latest" -d "$libraryFolderFull"
else
  echo 'Cache does not exist'
fi

# Restore LFS cache

# purge cache
if [ "$purgeRemoteBuilderCache" == "true" ]; then
  rm -r "$libraryFolderFull"
fi

