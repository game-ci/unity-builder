#!/usr/bin/env bash

if [[ -n "$UNITY_LICENSE" ]]; then
  #
  # PERSONAL LICENSE MODE
  #
  # This will activate Unity, using a license file
  #
  # Note that this is the ONLY WAY for PERSONAL LICENSES in 2019.
  #   * See for more details: https://gitlab.com/gableroux/unity3d-gitlab-ci-example/issues/5#note_72815478
  #
  # The license file can be acquired using `webbertakken/request-manual-activation-file` action.

  # Set the license file path
  FILE_PATH=UnityLicenseFile.ulf

  # Copy license file from Github variables
  echo "$UNITY_LICENSE" | tr -d '\r' > $FILE_PATH

  #
  # Activate license
  #
  # This is expected to always exit with code 1 (both success and failure).
  #
  echo "Requesting activation"
  ACTIVATION_OUTPUT=$(xvfb-run --auto-servernum --server-args='-screen 0 640x480x24' \
    /opt/Unity/Editor/Unity \
      -batchmode \
      -nographics \
      -logFile /dev/stdout \
      -quit \
      -manualLicenseFile $FILE_PATH)
  # Convert to exit code 0 by echoing the current exit code.
  echo $?
  # Exit code is now 0

  # TODO - remove debugging
  echo $ACTIVATION_OUTPUT
  echo $ACTIVATION_OUTPUT | grep 'config is NOT valid, switching to default'
  echo $ACTIVATION_OUTPUT | grep 'config is NOT valid, switching to default' | wc -l

  # TODO - Derive exit code by grepping success statement
  UNITY_EXIT_CODE=$(echo $ACTIVATION_OUTPUT | grep 'config is NOT valid, switching to default' | wc -l)

  # Display information about the result
  if [ $UNITY_EXIT_CODE -eq 0 ]; then
    echo "Activation (personal) complete."
  else
    echo "Unclassified error occured while trying to activate (personal) license."
    echo "Exit code was: $UNITY_EXIT_CODE"
  fi

  # Remove license file
  rm -f $FILE_PATH

  # Exit with the code from the license verification step
  if [ $UNITY_EXIT_CODE -ne 0 ]; then
    exit $UNITY_EXIT_CODE
  fi

else
  #
  # PROFESSIONAL (SERIAL) LICENSE MODE
  #
  # This will activate unity, using the activating process.
  #
  # Note: This is the preferred way for PROFESSIONAL LICENSES.
  #
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

  # Display information about the result
  if [ $UNITY_EXIT_CODE -eq 0 ]; then
    echo "Activation (professional) complete."
  else
    echo "Unclassified error occured while trying to activate (professional) license."
    echo "Exit code was: $UNITY_EXIT_CODE"
  fi

  # Exit with the code from the license verification step
  exit $UNITY_EXIT_CODE

fi
