#!/usr/bin/env bash

# Get host user/group info so we create files with the correct ownership
USERNAME=$(stat -c '%U' "$GITHUB_WORKSPACE/$PROJECT_PATH")
USERID=$(stat -c '%u' "$GITHUB_WORKSPACE/$PROJECT_PATH")
GROUPNAME=$(stat -c '%G' "$GITHUB_WORKSPACE/$PROJECT_PATH")
GROUPID=$(stat -c '%g' "$GITHUB_WORKSPACE/$PROJECT_PATH")

groupadd -g $GROUPID $GROUPNAME
useradd -u $USERID -g $GROUPID $USERNAME
usermod -aG $GROUPNAME $USERNAME
mkdir -p "/home/$USERNAME"
chown $USERNAME:$GROUPNAME "/home/$USERNAME"

# Switch to the host user so we can create files with the correct ownership
su - $USERNAME -c "$SHELL -c 'source /steps/runsteps.sh'"

exit $?
