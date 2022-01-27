#!/usr/bin/env bash

# Need this because it tries to initialize the library when deactivating
UNITY_PROJECT_PATH="$GITHUB_WORKSPACE/$PROJECT_PATH"

/Applications/Unity/Hub/Editor/$UNITY_VERSION/Unity.app/Contents/MacOS/Unity \
  -logFile /dev/stdout \
  -batchmode \
  -nographics \
  -quit \
  -returnlicense
