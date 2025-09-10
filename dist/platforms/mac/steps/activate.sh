#!/usr/bin/env bash

# Run in ACTIVATE_LICENSE_PATH directory
echo "Changing to \"$ACTIVATE_LICENSE_PATH\" directory."
pushd "$ACTIVATE_LICENSE_PATH"

if [[ -n "$UNITY_SERIAL" && -n "$UNITY_EMAIL" && -n "$UNITY_PASSWORD" ]]; then
  #
  # SERIAL LICENSE MODE
  #
  # This will activate unity, using the serial activation process.
  #

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

elif [[ -n "$UNITY_LICENSING_SERVER" ]]; then
  #
  # Custom Unity License Server
  #
  echo "Adding licensing server config"

  /Applications/Unity/Hub/Editor/$UNITY_VERSION/Unity.app/Contents/Frameworks/UnityLicensingClient.app/Contents/MacOS/Unity.Licensing.Client \
    --acquire-floating > license.txt
  PARSEDFILE=$(grep -oP '\".*?\"' < license.txt | tr -d '"')
  export FLOATING_LICENSE
  FLOATING_LICENSE=$(sed -n 2p <<< "$PARSEDFILE")
  FLOATING_LICENSE_TIMEOUT=$(sed -n 4p <<< "$PARSEDFILE")

  echo "Acquired floating license: \"$FLOATING_LICENSE\" with timeout $FLOATING_LICENSE_TIMEOUT"
  # Store the exit code from the verify command
  UNITY_EXIT_CODE=$?
else
  #
  # NO LICENSE ACTIVATION STRATEGY MATCHED
  #
  # This will exit since no activation strategies could be matched.
  #
  echo "License activation strategy could not be determined."
  echo ""
  echo "Visit https://game.ci/docs/github/activation for more"
  echo "details on how to set up one of the possible activation strategies."

  echo "::error ::No valid license activation strategy could be determined. Make sure to provide UNITY_EMAIL, UNITY_PASSWORD, and either a UNITY_SERIAL \
or UNITY_LICENSE. Otherwise please use UNITY_LICENSING_SERVER. See more info at https://game.ci/docs/github/activation"

  # Immediately exit as no UNITY_EXIT_CODE can be derived.
  exit 1;

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
  echo "::error ::There was an error while trying to activate the Unity license."
  exit $UNITY_EXIT_CODE
fi

# Return to previous working directory
popd
