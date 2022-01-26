#!/usr/bin/env bash

# Set environment variables for the build
set -o allexport; source $RUNNER_TEMP/build.env; set +o allexport;
printenv
#
# Run steps
#
source $SCRIPT_DIRECTORY/steps/setup.sh
source $SCRIPT_DIRECTORY/platforms/mac/steps/activate.sh
source $SCRIPT_DIRECTORY/platforms/mac/steps/build.sh
source $SCRIPT_DIRECTORY/platforms/mac/steps/return_license.sh

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

exit $BUILD_EXIT_CODE
