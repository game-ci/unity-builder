#!/usr/bin/env bash

# Run in ACTIVATE_LICENSE_PATH directory
echo "Changing to \"$ACTIVATE_LICENSE_PATH\" directory."
pushd "$ACTIVATE_LICENSE_PATH"

echo "Requesting activation"

# Activate license
/Applications/Unity/Hub/Editor/$UNITY_VERSION/Unity.app/Contents/MacOS/Unity \
  -logFile - \
  -batchmode \
  -nographics \
  -quit \
  -serial "$UNITY_SERIAL" \
  -username "$UNITY_EMAIL" \
  -password "$UNITY_PASSWORD" \
  -projectPath "$ACTIVATE_LICENSE_PATH"

# Store the exit code from the verify command
UNITY_EXIT_CODE=$?

#
# Display information about the result
#
if [ $UNITY_EXIT_CODE -eq 0 ]; then
  # Activation was a success
  echo "Activation complete."
else
  # Activation failed so exit with the code from the license verification step
  echo "Unclassified error occured while trying to activate license."
  echo "Exit code was: $UNITY_EXIT_CODE"
  echo "::error ::There was an error while trying to activate the Unity license."
  exit $UNITY_EXIT_CODE
fi

# Return to previous working directory
popd
