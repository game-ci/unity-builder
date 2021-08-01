#!/bin/sh

repoPathFull=$1
cloneUrl=$2
githubSha=$3
testLFSFile=$4

cd $repoPathFull

echo ' '
echo "Cloning the repository being built:"
git lfs install --skip-smudge
git clone $cloneUrl $repoPathFull
git checkout $githubSha
echo "Checked out $githubSha"

git lfs ls-files -l | cut -d ' ' -f1 | sort > .lfs-assets-id
md5sum .lfs-assets-id > .lfs-assets-id-sum

echo ' '
echo 'Contents of .lfs-assets-id file:'
cat .lfs-assets-id

echo ' '
echo 'Contents of .lfs-assets-id-sum file:'
cat .lfs-assets-id-sum

export LFS_ASSETS_HASH="$(cat .lfs-assets-id)"

echo ' '
