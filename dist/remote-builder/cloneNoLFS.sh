#!/bin/sh

apk add git-lfs

repoPathFull=$1
cloneUrl=$2
githubSha=$3

cd $repoPathFull

echo ' '
echo "Cloning the repository being built:"
git clone --filter=blob:none --no-checkout $cloneUrl $repoPathFull
git --work-tree=$repoPathFull checkout $githubSha

tree
echo ' '
# List git lfs files
git lfs ls-files --all
echo ' '
git lfs ls-files -l | cut -d ' ' -f1 | sort
echo ' '
git lfs ls-files -l | cut -d ' ' -f1 | sort > .lfs-assets-id

echo ' '
