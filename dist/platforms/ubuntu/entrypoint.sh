#!/usr/bin/env bash

# Get host user/group info so we create files with the correct ownership
USERNAME=stat -c '%U' "$GITHUB_WORKSPACE/$PROJECT_PATH"
USERID=stat -c '%u' "$GITHUB_WORKSPACE/$PROJECT_PATH"
GROUPNAME=stat -c '%G' "$GITHUB_WORKSPACE/$PROJECT_PATH"
GROUPID=stat -c '%g' "$GITHUB_WORKSPACE/$PROJECT_PATH"

useradd -u $USERID -g $GROUPID $USERNAME
usermod -aG $GROUPNAME $USERNAME
mkdir -p "/home/$USERNAME"
chown $USERNAME:$GROUPNAME "/home/$USERNAME"

# Switch to the host user so we can create files with the correct ownership
su - $USERNAME -c '
    #
    # Run steps
    #
    source /steps/set_extra_git_configs.sh
    source /steps/set_gitcredential.sh
    source /steps/activate.sh
    source /steps/build.sh
    source /steps/return_license.sh

    #
    # Instructions for debugging
    #

    if [[ $BUILD_EXIT_CODE -gt 0 ]]; then
    echo ""
    echo "###########################"
    echo "#         Failure         #"
    echo "###########################"
    echo ""
    echo "Please note that the exit code is not very descriptive."
    echo "Most likely it will not help you solve the issue."
    echo ""
    echo "To find the reason for failure: please search for errors in the log above."
    echo ""
    fi;

    #
    # Exit with code from the build step.
    #

    # Exiting su
    exit $BUILD_EXIT_CODE
'

# Exiting main script
exit $BUILD_EXIT_CODE
