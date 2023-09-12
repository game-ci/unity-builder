#!/usr/bin/env bash

if [ -z "${GIT_PRIVATE_TOKEN}" ]
then
  echo "GIT_PRIVATE_TOKEN unset skipping"
else
  echo "GIT_PRIVATE_TOKEN is set configuring git credentials"

	git config --global credential.helper store
	
    echo "activating credential halper..."
    git config --global credential.helper store

    echo "writing credentials to helper..."
    {
      echo protocol=https
      echo host=github.com
      echo username=token
      echo password=$GIT_PRIVATE_TOKEN
    } | git credential approve

    echo "displaying credentials file..."
    cat $HOME/.git-credentials

fi

echo "---------- git config --list -------------"
git config --list

echo "---------- git config --list --show-origin -------------"
git config --list --show-origin

