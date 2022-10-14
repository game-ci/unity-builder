#!/usr/bin/env bash
export UNITY_LICENSING_SERVER=test
cat services-config.json.template | tr -d '\r' | sed -e "s/%URL%/$UNITY_LICENSING_SERVER/" > services-config.json
