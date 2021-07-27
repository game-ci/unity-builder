#!/bin/sh

apk add git-lfs

repoPathFull=$1
cloneUrl=$2
githubSha=$3

cd $repoPathFull

echo ' '
echo "Cloning the repository being built:"
git clone --filter=blob:none --no-checkout $cloneUrl $repoPathFull
git checkout $githubSha
echo "Checked out $githubSha"

echo ' '
echo 'Tree of cloned target repository:'
tree

echo ' '
echo 'List all LFS file hashes:'
git lfs ls-files -l | cut -d ' ' -f1 | sort


echo ' '
echo 'Contents of .lfs-assets-id file:'
git lfs ls-files --all | cut -d ' ' -f1 | sort > .lfs-assets-id
echo .lfs-assets-id

echo ' '
