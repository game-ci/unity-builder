#!/usr/bin/env bash

if [[ -n "$UNITY_SERIAL" ]]; then
  #
  # PROFESSIONAL (SERIAL) LICENSE MODE
  #
  # This will return the license that is currently in use.
  #
  unity-editor \
    -batchmode \
    -nographics \
    -logFile /dev/stdout \
    -quit \
    -returnlicense
fi
