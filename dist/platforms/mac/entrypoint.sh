#!/usr/bin/env bash

#
# Perform Activation
#

if [ "$SKIP_ACTIVATION" != "true" ]; then
  UNITY_LICENSE_PATH="/Library/Application Support/Unity"

  if [ ! -d "$UNITY_LICENSE_PATH" ]; then
    echo "Creating Unity License Directory"
    sudo mkdir -p "$UNITY_LICENSE_PATH"
    sudo chmod -R 777 "$UNITY_LICENSE_PATH"
  fi;

  ACTIVATE_LICENSE_PATH="$ACTION_FOLDER/BlankProject"
  mkdir -p "$ACTIVATE_LICENSE_PATH"

  source $ACTION_FOLDER/platforms/mac/steps/activate.sh
else
  echo "Skipping activation"
fi

#
# Run Build
#

source $ACTION_FOLDER/platforms/mac/steps/build.sh

#
# License Cleanup
#

if [ "$SKIP_ACTIVATION" != "true" ]; then
  source $ACTION_FOLDER/platforms/mac/steps/return_license.sh
  rm -r "$ACTIVATE_LICENSE_PATH"
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

exit $BUILD_EXIT_CODE
