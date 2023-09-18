#!/usr/bin/env bash

# Run in ACTIVATE_LICENSE_PATH directory
echo "Changing to \"$ACTIVATE_LICENSE_PATH\" directory."
pushd "$ACTIVATE_LICENSE_PATH"

echo "Requesting activation"

if [[ -n "$UNITY_LICENSING_SERVER" ]]; then
   #
    # Custom Unity License Server
    #
    echo "Adding licensing server config"
    pushd "$ACTION_FOLDER"
    ls
    popd
    cat "$ACTION_FOLDER/unity-config/services-config.json"
    cp "$ACTION_FOLDER//unity-config/services-config.json" "/Library/Application Support/Unity/config/services-config.json"
   /Applications/Unity/Hub/Editor/$UNITY_VERSION/Unity.app/Contents/Frameworks/UnityLicensingClient.app/Contents/MacOS/Unity.Licensing.Client --acquire-floating > license.txt #is this accessible in a env variable?
    cat license.txt
    PARSEDFILE=$(grep -oE '\".*?\"' < license.txt | tr -d '"')
    grep -oE '\".*?\"' < license.txt
    export FLOATING_LICENSE
    FLOATING_LICENSE=$(sed -n 2p <<< "$PARSEDFILE")
    FLOATING_LICENSE_TIMEOUT=$(sed -n 4p <<< "$PARSEDFILE")

    echo "Acquired floating license: \"$FLOATING_LICENSE\" with timeout $FLOATING_LICENSE_TIMEOUT"
    # Store the exit code from the verify command
    UNITY_EXIT_CODE=$?
else
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
fi
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
