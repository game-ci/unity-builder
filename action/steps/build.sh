#!/usr/bin/env bash

#
# Set project path
#

UNITY_PROJECT_PATH="$GITHUB_WORKSPACE/$PROJECT_PATH"
echo "Using project path \"$UNITY_PROJECT_PATH\"."

#
# Display the name for the build, doubles as the output name
#

echo "Using build name \"$BUILD_NAME\"."

#
# Display the build's target platform;
#

echo "Using build target \"$BUILD_TARGET\"."

#
# Display build path and file
#

echo "Using build path \"$BUILD_PATH\" to save file \"$BUILD_FILE\"."
BUILD_PATH_FULL="$GITHUB_WORKSPACE/$BUILD_PATH"
CUSTOM_BUILD_PATH="$BUILD_PATH_FULL/$BUILD_FILE"

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
  mkdir -p "$UNITY_PROJECT_PATH/Assets/Editor/"
  # Copy the build script of Unity Builder action
  cp -r "/UnityBuilderAction/Assets/Editor" "$UNITY_PROJECT_PATH/Assets/Editor/"
  # Set the Build method to that of UnityBuilder Action
  BUILD_METHOD="UnityBuilderAction.Builder.BuildProject"
  # Verify recursive paths
  ls -Ralph "$UNITY_PROJECT_PATH/Assets/Editor/"
  #
else
  # User has provided their own build method.
  # Assume they also bring their own script.
  #
  echo "Using build method \"$BUILD_METHOD\"."
  #
fi

#
# Create Android keystore, if needed
#
if [[ -z $ANDROID_KEYSTORE_NAME || -z $ANDROID_KEYSTORE_BASE64 ]]; then
  echo "Not creating Android keystore."
else
  echo "$ANDROID_KEYSTORE_BASE64" | base64 --decode > "$ANDROID_KEYSTORE_NAME"
  echo "Created Android keystore."
fi

#
# Display custom parameters
#
echo "Using custom parameters $CUSTOM_PARAMETERS."

# The build specification below may require Unity 2019.2.11f1 or later (not tested below).
# Reference: https://docs.unity3d.com/2019.3/Documentation/Manual/CommandLineArguments.html

#
# Build info
#

echo ""
echo "###########################"
echo "#    Current build dir    #"
echo "###########################"
echo ""

echo "Creating \"$BUILD_PATH_FULL\" if it does not exist."
mkdir -p "$BUILD_PATH_FULL"
ls -alh "$BUILD_PATH_FULL"

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
    -customBuildPath "$CUSTOM_BUILD_PATH" \
    -executeMethod "$BUILD_METHOD" \
    -version "$VERSION" \
    -androidVersionCode "$ANDROID_VERSION_CODE" \
    -androidKeystoreName "$ANDROID_KEYSTORE_NAME" \
    -androidKeystorePass "$ANDROID_KEYSTORE_PASS" \
    -androidKeyaliasName "$ANDROID_KEYALIAS_NAME" \
    -androidKeyaliasPass "$ANDROID_KEYALIAS_PASS" \
    $CUSTOM_PARAMETERS

# Catch exit code
BUILD_EXIT_CODE=$?

# Display results
if [ $BUILD_EXIT_CODE -eq 0 ]; then
  echo "Build succeeded";
else
  echo "Build failed, with exit code $BUILD_EXIT_CODE";
fi

# Add permissions to make app runnable
if [[ "$BUILD_TARGET" == "StandaloneOSX" ]]; then
  ADD_PERMISSIONS_PATH=$BUILD_PATH_FULL/StandaloneOSX.app/Contents/MacOS/*
  echo "Making the following path executable: $ADD_PERMISSIONS_PATH"
  chmod +x $ADD_PERMISSIONS_PATH
fi

#
# Results
#

echo ""
echo "###########################"
echo "#     Build directory     #"
echo "###########################"
echo ""

ls -alh "$BUILD_PATH_FULL"
