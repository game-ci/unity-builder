#!/usr/bin/env bash

set_config_home() {
  if [ -z "${XDG_CONFIG_HOME}" ]
  then
    mkdir -p "${HOME}/.config"
    export XDG_CONFIG_HOME="${HOME}/.config"
  fi

  mkdir -p "${XDG_CONFIG_HOME}/git"

}

configure_git_credentials() {
  echo "${GIT_CREDENTIAL}" >> "${XDG_CONFIG_HOME}/git/credentials"
  chmod 0600 "${XDG_CONFIG_HOME}/git/credentials"

	git config --global credential.helper store
	git config --global --replace-all url.https://github.com/.insteadOf ssh://git@github.com/
	git config --global --add url.https://github.com/.insteadOf git@github.com
}

if [ -z "${GIT_CREDENTIAL}" ]
then
  echo "GIT_CREDENTIAL unset skipping"
else
  echo "GIT_CREDENTIAL is set configuring git credentials"
  set_config_home
  configure_git_credentials
fi


