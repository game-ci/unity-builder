#!/bin/sh

repoPathFull=$1
cloneUrl=$2
githubSha=$3

cd $repoPathFull

echo ' '
echo "Cloning the repository being built:"
# DISABLE LFS
export GIT_LFS_SKIP_SMUDGE=1
# Init new repo and setup origin
git init
git remote add origin $cloneUrl
# Get remote version
git fetch origin
git reset --hard $githubSha
# ENABLE LFS
export GIT_LFS_SKIP_SMUDGE=0

tree
echo ' '
# List git lfs files
git lfs ls-files --all
echo ' '
git lfs ls-files -l | cut -d ' ' -f1 | sort
echo ' '
git lfs ls-files -l | cut -d ' ' -f1 | sort > $1/.lfs-assets-id

echo ' '
