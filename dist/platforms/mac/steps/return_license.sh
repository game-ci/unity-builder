#!/usr/bin/env bash

# Run in ACTIVATE_LICENSE_PATH directory
echo "Changing to \"$ACTIVATE_LICENSE_PATH\" directory."
pushd "$ACTIVATE_LICENSE_PATH"

if [[ -n "$UNITY_LICENSING_SERVER" ]]; then
  #
  # Return any floating license used.
  #
  echo "Returning floating license: \"$FLOATING_LICENSE\""
  /Applications/Unity/Hub/Editor/$UNITY_VERSION/Unity.app/Contents/Frameworks/UnityLicensingClient.app/Contents/MacOS/Unity.Licensing.Client \
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
