#!/usr/bin/env bash

# Try personal activation
if [[ -n "$UNITY_LICENSE" ]]; then
  LICENSE_MODE="personal"
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

  # Remove license file
  rm -f $FILE_PATH

# Try professional activation
elif [[ -n "$UNITY_SERIAL" && -n "$UNITY_EMAIL" && -n "$UNITY_PASSWORD" ]]; then
  LICENSE_MODE="professional"
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

# Exit since personal and professional modes failed
else
  echo "No personal or professional licenses provided!"
  echo "Please ensure you have setup one of these licensing methods:"
  echo "  - Personal: Set the UNITY_LICENSE environment variable."
  echo "  - Professional: Set the UNITY_EMAIL, UNITY_PASSWORD and UNITY_SERIAL environment variables."
  echo "See https://github.com/webbertakken/unity-builder#usage for details."
  exit 1;
fi

# Display information about the result
if [ $UNITY_EXIT_CODE -eq 0 ]; then
  echo "Activation ($LICENSE_MODE) complete."
else
  # Exit with the code from the license verification step
  echo "Unclassified error occured while trying to activate ($LICENSE_MODE) license."
  echo "Exit code was: $UNITY_EXIT_CODE"
  exit $UNITY_EXIT_CODE
fi
