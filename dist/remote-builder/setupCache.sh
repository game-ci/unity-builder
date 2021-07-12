#!/bin/sh

cacheFolderFull=$1
branchName=$2
libraryFolderFull=$3

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
