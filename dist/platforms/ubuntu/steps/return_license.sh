#!/usr/bin/env bash

# Run in ACTIVATE_LICENSE_PATH directory
echo "Changing to \"$ACTIVATE_LICENSE_PATH\" directory."
pushd "$ACTIVATE_LICENSE_PATH"

if [[ -n "$UNITY_SERIAL" ]]; then
  #
  # PROFESSIONAL (SERIAL) LICENSE MODE
  #
  # This will return the license that is currently in use.
  #
  unity-editor \
    -logFile /dev/stdout \
    -quit \
    -returnlicense
elif [[ -n "$UNITY_LICENSING_SERVER" ]]; then  #
  #
  # Return any floating license used.
  #
  echo "Returning floating licenses"
  for file in ~/.config/unity3d/Unity/licenses/*.xml; do
      echo "$file"
      token=$(basename $file .xml)
      /opt/unity/Editor/Data/Resources/Licensing/Client/Unity.Licensing.Client --return-floating $token
      status=$?
      echo "status $status"
      echo "Returned $token"
  done

fi

# Return to previous working directory
popd
