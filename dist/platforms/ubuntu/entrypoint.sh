#!/usr/bin/env bash

fullProjectPath="$GITHUB_WORKSPACE/$PROJECT_PATH"

# Get host user/group info so we create files with the correct ownership
USERNAME=$(stat -c '%U' "$fullProjectPath")
USERID=$(stat -c '%u' "$fullProjectPath")
GROUPNAME=$(stat -c '%G' "$fullProjectPath")
GROUPID=$(stat -c '%g' "$fullProjectPath")

groupadd -g $GROUPID $GROUPNAME
useradd -u $USERID -g $GROUPID $USERNAME
usermod -aG $GROUPNAME $USERNAME
mkdir -p "/home/$USERNAME"
chown $USERNAME:$GROUPNAME "/home/$USERNAME"

# Normally need root permissions to access when using su
chmod 777 /dev/stdout
chmod 777 /dev/stderr

#
# Prepare Android SDK, if needed
# We do this here to ensure it has root permissions
#

if [[ "$BUILD_TARGET" == "Android" ]]; then
  export JAVA_HOME="$(awk -F'=' '/JAVA_HOME=/{print $2}' /usr/bin/unity-editor.d/*)"
  ANDROID_HOME_DIRECTORY="$(awk -F'=' '/ANDROID_HOME=/{print $2}' /usr/bin/unity-editor.d/*)"
  SDKMANAGER=$(find $ANDROID_HOME_DIRECTORY/cmdline-tools -name sdkmanager)
  if [ -z "${SDKMANAGER}" ]
  then
    echo "No sdkmanager found"
    exit 1
  fi

  if [[ -n "$ANDROID_SDK_MANAGER_PARAMETERS" ]]; then
    echo "Updating Android SDK with parameters: $ANDROID_SDK_MANAGER_PARAMETERS"
    $SDKMANAGER "$ANDROID_SDK_MANAGER_PARAMETERS"
  else
    echo "Updating Android SDK with auto detected target API version"
    # Read the line containing AndroidTargetSdkVersion from the file
    targetAPILine=$(grep 'AndroidTargetSdkVersion' "$fullProjectPath/ProjectSettings/ProjectSettings.asset")

    # Extract the number after the semicolon
    targetAPI=$(echo "$targetAPILine" | cut -d':' -f2 | tr -d '[:space:]')

    $SDKMANAGER "platforms;android-$targetAPI"
  fi

  echo "Updated Android SDK."
else
  echo "Not updating Android SDK."
fi

if [[ "RUN_AS_HOST_USER" == "true" ]]; then
  # Switch to the host user so we can create files with the correct ownership
  su $USERNAME -c "$SHELL -c 'source /steps/runsteps.sh'"
else
  # Run as root
  source /steps/runsteps.sh
fi

exit $?
