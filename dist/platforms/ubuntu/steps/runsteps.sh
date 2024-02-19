#!/usr/bin/env bash

#
# Run steps
#
source /steps/set_extra_git_configs.sh
source /steps/set_gitcredential.sh

if [ "$SKIP_ACTIVATION" != "true" ]; then
  source /steps/activate.sh

  # If we didn't activate successfully, exit with the exit code from the activation step.
  if [[ $UNITY_EXIT_CODE -ne 0 ]]; then
    exit $UNITY_EXIT_CODE
  fi
else
  echo "Skipping activation"
fi

source /steps/build.sh

if [ "$SKIP_ACTIVATION" != "true" ]; then
  source /steps/return_license.sh
fi

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
echo "To find the reason for failure: please search for errors in the log above and check for annotations in the summary view."
echo ""
fi;

#
# Exit with code from the build step.
#

# Exiting su
exit $BUILD_EXIT_CODE
