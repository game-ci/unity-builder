#!/bin/sh

repoPathFull=$1
cloneUrl=$2
githubSha=$3

cd $repoPathFull

echo ' '
echo "Cloning the repository being built:"
git clone $cloneUrl $repoPathFull $githubSha

apk add git-lfs

tree
echo ' '
# List git lfs files
git lfs ls-files --all
echo ' '
git lfs ls-files -l | cut -d ' ' -f1 | sort
echo ' '
git lfs ls-files -l | cut -d ' ' -f1 | sort > .lfs-assets-id

echo ' '
