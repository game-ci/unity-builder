#!/bin/sh

repoPathFull=$1
cloneUrl=$2
githubSha=$3

cd $repoPathFull

echo ' '
echo "Cloning the repository being built:"
# DISABLE LFS
git config --global filter.lfs.smudge "git-lfs smudge --skip -- %f"
git config --global filter.lfs.process "git-lfs filter-process --skip"
# Init new repo and setup origin
git init
git remote add origin $cloneUrl
# Get remote version
git fetch origin
git reset --hard $githubSha
# ENABLE LFS
git config --global filter.lfs.smudge "git-lfs smudge -- %f"
git config --global filter.lfs.process "git-lfs filter-process"

tree
# List git lfs files
git lfs ls-files --all
echo ' '
