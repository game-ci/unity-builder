#!/usr/bin/env bash

# Run in ACTIVATE_LICENSE_PATH directory
echo "Changing to \"$ACTIVATE_LICENSE_PATH\" directory."
pushd "$ACTIVATE_LICENSE_PATH"

if [[ -n "$UNITY_LICENSING_SERVER" ]]; then
  #
  # Return any floating license used.
  #
  echo "Returning floating license: \"$FLOATING_LICENSE\""
  UNITY_EDITOR_DIR="/Applications/Unity/Hub/Editor/$UNITY_VERSION/Unity.app"
  UNITY_LICENSING_CLIENT_SUBDIR="Frameworks"

  # Unity 6000.3+ moved UnityLicensingClient from Contents/Frameworks to Contents/Helpers.
  # See: https://docs.unity.com/en-us/licensing-server/client-config
  if [[ "$UNITY_VERSION" =~ ^6000\.([3-9]|[1-9][0-9]) ]]; then
    UNITY_LICENSING_CLIENT_SUBDIR="Helpers"
  fi

  "$UNITY_EDITOR_DIR/Contents/$UNITY_LICENSING_CLIENT_SUBDIR/UnityLicensingClient.app/Contents/MacOS/Unity.Licensing.Client" \
    --return-floating "$FLOATING_LICENSE"
elif [[ -n "$UNITY_SERIAL" ]]; then
  #
  # SERIAL LICENSE MODE
  #
  # This will return the license that is currently in use.
  #
  /Applications/Unity/Hub/Editor/$UNITY_VERSION/Unity.app/Contents/MacOS/Unity \
    -logFile - \
    -batchmode \
    -nographics \
    -quit \
    -username "$UNITY_EMAIL" \
    -password "$UNITY_PASSWORD" \
    -returnlicense \
    -projectPath "$ACTIVATE_LICENSE_PATH"
fi

# Return to previous working directory
popd
