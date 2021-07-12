#!/bin/sh

repoPathFull=$1
cloneUrl=$2
githubSha=$3

cd $repoPathFull
# DISABLE LFS
git config --global filter.lfs.smudge "git-lfs smudge --skip -- %f"
git config --global filter.lfs.process "git-lfs filter-process --skip"
echo ''
echo "Cloning the repository being built:"
git init -q
git remote add origin $cloneUrl
git fetch origin
echo $githubSha
git reset --hard $githubSha
git lfs ls-files --all
echo ''
