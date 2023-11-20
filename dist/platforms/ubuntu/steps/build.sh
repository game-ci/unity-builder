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
  cp -R "/UnityBuilderAction/Assets/Editor/" "$UNITY_PROJECT_PATH/Assets/Editor/"
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
# Pre-build debug information
#

echo ""
echo "###########################"
echo "#    Custom parameters    #"
echo "###########################"
echo ""

echo "$CUSTOM_PARAMETERS"

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

ls -alh "$UNITY_PROJECT_PATH"

#
# Build
#

echo ""
echo "###########################"
echo "#    Building project     #"
echo "###########################"
echo ""

# Reference: https://docs.unity3d.com/2019.3/Documentation/Manual/CommandLineArguments.html

unity-editor \
  -logfile /dev/stdout \
  $( [ "${MANUAL_EXIT}" == "true" ] || echo "-quit" ) \
  -customBuildName "$BUILD_NAME" \
  -projectPath "$UNITY_PROJECT_PATH" \
  -buildTarget "$BUILD_TARGET" \
  -customBuildTarget "$BUILD_TARGET" \
  -customBuildPath "$CUSTOM_BUILD_PATH" \
  -executeMethod "$BUILD_METHOD" \
  -buildVersion "$VERSION" \
  -androidVersionCode "$ANDROID_VERSION_CODE" \
  -androidKeystoreName "$ANDROID_KEYSTORE_NAME" \
  -androidKeystorePass "$ANDROID_KEYSTORE_PASS" \
  -androidKeyaliasName "$ANDROID_KEYALIAS_NAME" \
  -androidKeyaliasPass "$ANDROID_KEYALIAS_PASS" \
  -androidTargetSdkVersion "$ANDROID_TARGET_SDK_VERSION" \
  -androidExportType "$ANDROID_EXPORT_TYPE" \
  -androidSymbolType "$ANDROID_SYMBOL_TYPE" \
  $CUSTOM_PARAMETERS

# Catch exit code
BUILD_EXIT_CODE=$?

# Display results
if [ $BUILD_EXIT_CODE -eq 0 ]; then
  echo "Build succeeded";
else
  echo "Build failed, with exit code $BUILD_EXIT_CODE";
fi

#
# Permissions
#

# Make a given user owner of all artifacts
if [[ -n "$CHOWN_FILES_TO" ]]; then
  echo "Changing ownership of files to $CHOWN_FILES_TO for $BUILD_PATH_FULL and $UNITY_PROJECT_PATH"
  chown -R "$CHOWN_FILES_TO" "$BUILD_PATH_FULL"
  chown -R "$CHOWN_FILES_TO" "$UNITY_PROJECT_PATH"
fi

# Add read permissions for everyone to all artifacts
chmod -R a+r "$BUILD_PATH_FULL"
chmod -R a+r "$UNITY_PROJECT_PATH"

# Add execute permissions to specific files
if [[ "$BUILD_TARGET" == "StandaloneOSX" ]]; then
  OSX_EXECUTABLE_PATH="$BUILD_PATH_FULL/$BUILD_NAME.app/Contents/MacOS"
  find "$OSX_EXECUTABLE_PATH" -type f -exec chmod +x {} \;
fi

#
# Results
#

echo ""
echo "###########################"
echo "#       Build output      #"
echo "###########################"
echo ""

ls -alh "$BUILD_PATH_FULL"
