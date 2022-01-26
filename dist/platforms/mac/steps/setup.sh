#!/usr/bin/env bash

echo "Installing Unity Hub"

brew install unity-hub

echo "Installing Unity Editor $UNITY_VERSION ($UNITY_CHANGESET)"

/Applications/Unity\ Hub.app/Contents/MacOS/Unity\ Hub -- --headless install
                                                       --version $UNITY_VERSION
                                                       --changeset $UNITY_CHANGESET
                                                       --module mac-il2cpp
                                                       --childModules
