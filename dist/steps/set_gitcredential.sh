#!/usr/bin/env bash

if [ -z "${GIT_CREDENTIAL}" ]
then
  echo "GIT_CREDENTIAL unset skipping"
else
  echo "GIT_CREDENTIAL is set configuring git credentials"

	git config --global credential.helper store
	git config --global --replace-all url.https://github.com/.insteadOf ssh://git@github.com/
	git config --global --add url.https://github.com/.insteadOf git@github.com

  git config --global url."https://ssh:$GIT_CREDENTIAL@github.com/".insteadOf "ssh://git@github.com/"
  git config --global url."https://git:$GIT_CREDENTIAL@github.com/".insteadOf "git@github.com:"

fi

echo "---------- git config --list -------------"
git config --list

echo "---------- git config --list --show-origin -------------"
git config --list --show-origin

