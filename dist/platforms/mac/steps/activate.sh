#!/usr/bin/env bash

echo "Requesting activation"

# Make directory for license
sudo mkdir /Library/Application\ Support/Unity
sudo chmod -R 777 /Library/Application\ Support/Unity

# Activate license
/Applications/Unity/Hub/Editor/$UNITY_VERSION/Unity.app/Contents/MacOS/Unity \
  -logFile /dev/stdout \
  -batchmode \
  -nographics \
  -quit \
  -serial "$UNITY_SERIAL" \
  -username "$UNITY_EMAIL" \
  -password "$UNITY_PASSWORD"

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
  exit $UNITY_EXIT_CODE
fi

# Return to previous working directory
popd
