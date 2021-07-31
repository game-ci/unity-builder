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

cacheFolderWithBranch="$cacheFolderFull/$branchName"

echo " "
# handle library cache
if [ ! -d "$cacheFolderFull" ]; then
  echo "creating new cache folder $cacheFolderFull"
  mkdir "$cacheFolderFull"
  if [ ! -d "$cacheFolderWithBranch" ]; then
    echo "creating new cache branch folder for: $cacheFolderWithBranch"
    mkdir "$cacheFolderWithBranch"
  else
    echo "cache branch folder already exists for: $cacheFolderWithBranch"
  fi
else
  echo "cache folder already exists $cacheFolderFull"
fi

echo "Library cache for branch: $branchName"
ls -lh "$cacheFolderWithBranch"
echo ''

if [ -d "$libraryFolderFull" ]; then
  rm -r "$libraryFolderFull"
  echo "Git must ignore the Library folder"
fi


echo "Checking cache"

# Restore library cache
latest=$(ls -t "$cacheFolderWithBranch" | egrep -i -e '\\.zip$' | head -1)

if [ "$(ls -A $latest)" ]; then
  echo 'Cache empty'
else if [ ! -z "$latest" ]; then
  echo "Library cache exists from build $latest from $branchName"
  echo 'Creating empty Library folder for cache'
  mkdir "$libraryFolderFull"
  unzip -q "$cacheFolderWithBranch/$latest" -d "$libraryFolderFull"
else
  echo 'Cache does not exist'
fi

# Restore LFS cache

# purge cache
if [ "$purgeRemoteBuilderCache" == "true" ]; then
  rm -r "$libraryFolderFull"
fi

