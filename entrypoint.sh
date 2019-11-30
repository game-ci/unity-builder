#!/usr/bin/env bash

#
# Set license file path
#

LICENSE_FILE_PATH=UnityLicenseFile.ulf

#
# Set project path
#

UNITY_PROJECT_PATH=$GITHUB_WORKSPACE/$UNITY_PROJECT_PATH

#
# Set the name for the build
#

if [ -z "$BUILD_NAME" ]; then
  BUILD_NAME=buildName
fi

#
# Set the builds target platform;
#
# possible options are:
#
# Standalone, Win, Win64, OSXUniversal,
# Linux64, iOS, Android, WebGL, XboxOne,
# PS4, WindowsStoreApps, Switch, tvOS
#
# Default to WebGL (no particular reason)
#

if [ -z "$BUILD_TARGET" ]; then
  BUILD_TARGET=WebGL
fi

#
# Set builds path
#

if [ -z "$BUILDS_PATH" ]; then
  BUILDS_PATH=build
fi
BUILDS_FULL_PATH=$GITHUB_WORKSPACE/$BUILDS_PATH

#
# Set path for current build (relative and full)
#

CURRENT_BUILD_PATH=$BUILDS_PATH/$BUILD_TARGET
CURRENT_BUILD_FULL_PATH=$BUILDS_FULL_PATH/$BUILD_TARGET

#
# Set the build command, must reference one of:
#
#   - <NamespaceName.ClassName.MethodName>
#   - <ClassName.MethodName>
#
# For example: `BuildCommand.PerformBuild`
#
# The method must be defined static
#

if [ -z "$BUILD_COMMAND" ]; then
  # TODO - copy Builder class from root
  EXECUTE_CUSTOM_METHOD="-executeMethod Builder.BuildProject"
else
  EXECUTE_CUSTOM_METHOD="-executeMethod $BUILD_COMMAND"
fi

#
# Copy license file from Github variables
#

echo "$UNITY_LICENSE" | tr -d '\r' > $LICENSE_FILE_PATH
echo "$UNITY_LICENSE" | tr -d '\r' > /root/.local/share/unity3d/Unity/Unity_lic.ulf
# TODO - test if this line has any effect
echo "$UNITY_LICENSE" | tr -d '\r' > /root/.local/share/unity3d/Unity/Unity_v2019.x.ulf

#
# Activate license
#

echo "Requesting activation"
xvfb-run --auto-servernum --server-args='-screen 0 640x480x24' \
  /opt/Unity/Editor/Unity \
    -batchmode \
    -nographics \
    -logFile /dev/stdout \
    -quit \
    -manualLicenseFile $LICENSE_FILE_PATH
# This is expected to always exit with code 1 (both success and failure).
# Convert to exit code 0 by echoing the current exit code.
echo $?
# Exit code is now 0

# The build specification below may require Unity 2019.2.11f1 or later (not tested below).
# Reference: https://docs.unity3d.com/2019.3/Documentation/Manual/CommandLineArguments.html

#
# Build info
#

echo ""
echo "###########################"
echo "#      All builds dir     #"
echo "###########################"
echo ""

echo "Creating \"$BUILDS_FULL_PATH\" if it does not exist."
mkdir -p $BUILDS_FULL_PATH
ls -alh $BUILDS_FULL_PATH

echo ""
echo "###########################"
echo "#    Current build dir    #"
echo "###########################"
echo ""

echo "Creating \"$CURRENT_BUILD_FULL_PATH\" if it does not exist."
mkdir -p $CURRENT_BUILD_FULL_PATH
ls -alh $CURRENT_BUILD_FULL_PATH

echo ""
echo "###########################"
echo "#    Project directory    #"
echo "###########################"
echo ""

ls -alh $UNITY_PROJECT_PATH

echo ""
echo "###########################"
echo "#    Building platform    #"
echo "###########################"
echo ""

xvfb-run --auto-servernum --server-args='-screen 0 640x480x24' \
  /opt/Unity/Editor/Unity \
    -batchmode \
    -logfile /dev/stdout \
    -quit \
    -customBuildName "$BUILD_NAME" \
    -projectPath "$UNITY_PROJECT_PATH" \
    -buildTarget "$BUILD_TARGET" \
    -customBuildTarget "$BUILD_TARGET" \
    -customBuildPath "$CURRENT_BUILD_FULL_PATH" \
    $EXECUTE_CUSTOM_METHOD

# Catch exit code
BUILD_EXIT_CODE=$?

# Display results
if [ $BUILD_EXIT_CODE -eq 0 ]; then
  echo "Build succeeded";
else
  echo "Build failed, with exit code $BUILD_EXIT_CODE";
fi

#
# Results
#

echo ""
echo "###########################"
echo "#     Build directory     #"
echo "###########################"
echo ""

ls -alh $CURRENT_BUILD_FULL_PATH

#
# Output variables
#

# Expose path for the resulting build
echo ::set-output name=buildPath::$CURRENT_BUILD_PATH

# Expose path that contains all builds
echo ::set-output name=allBuildsPath::$BUILDS_PATH

#
# Exit
#

exit $BUILD_EXIT_CODE
