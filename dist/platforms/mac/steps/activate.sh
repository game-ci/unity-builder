#!/usr/bin/env bash

# Run in ACTIVATE_LICENSE_PATH directory
echo "Changing to \"$ACTIVATE_LICENSE_PATH\" directory."
pushd "$ACTIVATE_LICENSE_PATH"

echo "Requesting activation"


if [[ -n "$UNITY_SERIAL" && -n "$UNITY_EMAIL" && -n "$UNITY_PASSWORD" ]]; then


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
  echo "Echoing the floating license address $UNITY_LICENSING_SERVER"
  echo "Copying the services-config.json to Library"
  cp ../unity-config/services-config.json /Library/Application\ Support/Unity/config/

  /Applications/Unity/Hub/Editor/$UNITY_VERSION/Unity.app/Contents/Frameworks/UnityLicensingClient.app/Contents/Resources/Unity.Licensing.Client --acquire-floating > license.txt #is this accessible in a env variable?

  ##PARSEDFILE=$(grep -oP '\".*?\"' < license.txt | tr -d '"')
  FLOATING_LICENSE=$(cat license.txt | awk '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' | awk '{print $6}' | sed 's/.$//')
  export FLOATING_LICENSE
  ##FLOATING_LICENSE=$(sed -n 2p <<< "$PARSEDFILE")
  #FLOATING_LICENSE_TIMEOUT=$(sed -n 4p <<< "$PARSEDFILE")

  echo "Acquired floating license: \"$FLOATING_LICENSE\""
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
  echo "Visit https://game.ci/docs/github/getting-started for more"
  echo "details on how to set up one of the possible activation strategies."

  # Immediately exit as no UNITY_EXIT_CODE can be derrived.
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
  exit $UNITY_EXIT_CODE
fi

# Return to previous working directory
popd
