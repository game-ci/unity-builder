#!/usr/bin/env bash

if [[ -n "$UNITY_LICENSE" ]]; then
  #
  # PERSONAL LICENSE MODE
  #
  # This will activate Unity, using a license file
  #
  # Note that this is the ONLY WAY for PERSONAL LICENSES in 2020.
  #   * See for more details: https://gitlab.com/gableroux/unity3d-gitlab-ci-example/issues/5#note_72815478
  #
  # The license file can be acquired using `webbertakken/request-manual-activation-file` action.
  echo "Requesting activation (personal license)"

  # Set the license file path
  FILE_PATH=UnityLicenseFile.ulf

  # Copy license file from Github variables
  echo "$UNITY_LICENSE" | tr -d '\r' > $FILE_PATH

  # Activate license
  ACTIVATION_OUTPUT=$(xvfb-run --auto-servernum --server-args='-screen 0 640x480x24' \
    /opt/Unity/Editor/Unity \
      -batchmode \
      -nographics \
      -logFile /dev/stdout \
      -quit \
      -manualLicenseFile $FILE_PATH)

  # Store the exit code from the verify command
  UNITY_EXIT_CODE=$?

  # The exit code for personal activation is always 1;
  # Determine whether activation was successful.
  #
  # Successful output should include the following:
  #
  #   "LICENSE SYSTEM [2020120 18:51:20] Next license update check is after 2019-11-25T18:23:38"
  #
  ACTIVATION_SUCCESSFUL=$(echo $ACTIVATION_OUTPUT | grep 'Next license update check is after' | wc -l)

  # Set exit code to 0 if activation was successful
  if [[ $ACTIVATION_SUCCESSFUL -eq 1 ]]; then
    UNITY_EXIT_CODE=0
  fi;

  # Remove license file
  rm -f $FILE_PATH

elif [[ -n "$UNITY_SERIAL" && -n "$UNITY_EMAIL" && -n "$UNITY_PASSWORD" ]]; then
  #
  # PROFESSIONAL (SERIAL) LICENSE MODE
  #
  # This will activate unity, using the activating process.
  #
  # Note: This is the preferred way for PROFESSIONAL LICENSES.
  #
  echo "Requesting activation (professional license)"

  # Activate license
  xvfb-run --auto-servernum --server-args='-screen 0 640x480x24' \
    /opt/Unity/Editor/Unity \
      -batchmode \
      -nographics \
      -logFile /dev/stdout \
      -quit \
      -serial "$UNITY_SERIAL" \
      -username "$UNITY_EMAIL" \
      -password "$UNITY_PASSWORD"

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
  echo "Visit https://github.com/webbertakken/unity-builder#usage for more"
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
