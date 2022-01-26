#!/usr/bin/env bash

pwd

#
# Create directory for license activation
#

sudo mkdir /Library/Application\ Support/Unity
sudo chmod -R 777 /Library/Application\ Support/Unity

#
# Run steps
#
source /steps/activate.sh
source /steps/build.sh
source /steps/return_license.sh

#
# Remove license activation directory
#

sudo rm -r /Library/Application\ Support/Unity

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
