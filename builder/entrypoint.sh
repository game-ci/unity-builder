#!/usr/bin/env bash

#
# Set project path
#

UNITY_PROJECT_PATH=$GITHUB_WORKSPACE/$PROJECT_PATH
echo "Using project path \"$UNITY_PROJECT_PATH\"."

#
# Set the name for the build
#

if [ -z "$BUILD_NAME" ]; then
  BUILD_NAME="build-$(date '+%F-%H%M')"
fi
echo "Using build name \"$BUILD_NAME\"."

#
# Set the builds target platform;
#
# Web:     WebGL
# Desktop: StandaloneOSX, StandaloneWindows, StandaloneWindows64, StandaloneLinux64
# Console: PS4, XboxOne, Switch
# Mobile:  Android, iOS
# Other:   tvOS, Lumin, BJM, WSAPlayer
#
# Default to WebGL (no particular reason)
#

if [ -z "$BUILD_TARGET" ]; then
  BUILD_TARGET=WebGL
fi
echo "Using build target \"$BUILD_TARGET\"."

#
# Set builds path
#

if [ -z "$BUILDS_PATH" ]; then
  BUILDS_PATH=build
fi
BUILDS_FULL_PATH=$GITHUB_WORKSPACE/$BUILDS_PATH
CURRENT_BUILD_PATH=$BUILDS_PATH/$BUILD_TARGET
CURRENT_BUILD_FULL_PATH=$BUILDS_FULL_PATH/$BUILD_TARGET
echo "Using build path \"$CURRENT_BUILD_PATH\"."

#
# Set the build method, must reference one of:
#
#   - <NamespaceName.ClassName.MethodName>
#   - <ClassName.MethodName>
#
# For example: `BuildCommand.PerformBuild`
#
# The method must be declared static and placed in project/Assets/Editor
#

if [ -z "$BUILD_METHOD" ]; then
  # User has not provided their own build command.
  #
  # Use the script from this action which builds the scenes that are enabled in
  # the project.
  #
  echo "Using built-in build method."
  # Create Editor directory if it does not exist
  mkdir -p $UNITY_PROJECT_PATH/Assets/Editor/
  # Copy the build script of Unity Builder action
  cp -r /UnityBuilderAction $UNITY_PROJECT_PATH/Assets/Editor/
  # Set the Build method to that of UnityBuilder Action
  BUILD_METHOD="UnityBuilderAction.Builder.BuildProject"
  # Verify recursive paths
  ls -Ralph $UNITY_PROJECT_PATH/Assets/Editor/
  #
else
  # User has provided their own build method.
  # Assume they also bring their own script.
  #
  echo "User set build method to $BUILD_METHOD."
  #
fi

# Set build method to execute as flag + argument
EXECUTE_BUILD_METHOD="-executeMethod $BUILD_METHOD"


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
    $EXECUTE_BUILD_METHOD

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
