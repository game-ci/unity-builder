#!/bin/sh

repoPathFull=$1
cloneUrl=$2
githubSha=$3

echo ''
echo "Cloning the repository being built:"
# DISABLE LFS
git config --global filter.lfs.smudge "git-lfs smudge --skip -- %f"
git config --global filter.lfs.process "git-lfs filter-process --skip"
# Init new repo and setup origin
git init --work-tree=$repoPathFull
git remote add origin $cloneUrl --work-tree=$repoPathFull
# Get remote version
git fetch origin --work-tree=$repoPathFull
git reset --hard $githubSha --work-tree=$repoPathFull
git lfs ls-files --all --work-tree=$repoPathFull
echo ''
