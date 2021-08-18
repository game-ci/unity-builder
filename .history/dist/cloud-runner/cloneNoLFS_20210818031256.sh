#!/bin/sh

repoPathFull=$1
cloneUrl=$2
testLFSFile=$3

githubSha=$GITHUB_SHA

cd $repoPathFull

# stop annoying git detatched head info
git config --global advice.detachedHead false

echo ' '
echo "Cloning the repository being built:"
git lfs install --skip-smudge
git clone $cloneUrl $repoPathFull
git checkout $githubSha
echo "Checked out $githubSha"

git lfs ls-files -l | cut -d ' ' -f1 | sort > .lfs-assets-guid
md5sum .lfs-assets-guid > .lfs-assets-guid-sum
export LFS_ASSETS_HASH="$(cat ${this.repoPathFull}/.lfs-assets-guid)"

echo ' '
echo 'Contents of .lfs-assets-guid file:'
cat .lfs-assets-guid

echo ' '
echo 'Contents of .lfs-assets-guid-sum file:'
cat .lfs-assets-guid-sum

echo ' '
