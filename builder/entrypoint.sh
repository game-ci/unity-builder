#!/usr/bin/env bash

#
# Run steps
#

source /steps/activate.sh
source /steps/build.sh
source /steps/return_license.sh

#
# Exit with code from the build step.
#

exit $BUILD_EXIT_CODE
