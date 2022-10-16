#!/usr/bin/env bash

# Run in ACTIVATE_LICENSE_PATH directory
echo "Changing to \"$ACTIVATE_LICENSE_PATH\" directory."
pushd "$ACTIVATE_LICENSE_PATH"


if [[ -n "$UNITY_LICENSING_SERVER" ]]; then  #
  #
  # Return any floating license used.
  #
  echo "Returning floating license: \"$FLOATING_LICENSE\""
  /opt/unity/Editor/Data/Resources/Licensing/Client/Unity.Licensing.Client --return-floating "$FLOATING_LICENSE"
elif [[ -n "$UNITY_SERIAL" ]]; then
  #
  # PROFESSIONAL (SERIAL) LICENSE MODE
  #
  # This will return the license that is currently in use.
  #
  unity-editor \
    -logFile /dev/stdout \
    -quit \
    -returnlicense
fi

# Return to previous working directory
popd
