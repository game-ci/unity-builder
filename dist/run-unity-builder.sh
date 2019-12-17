#!/usr/bin/env sh

PROJECT_PATH=$1
BUILD_TARGET=$2
BUILD_NAME=$3
BUILDS_PATH=$4
BUILD_METHOD=$5

DOCKER_IMAGE_TAG=unity-builder-image

echo "Running docker container with specific tag"

docker build \
  --file ../Dockerfile \
  --tag DOCKER_IMAGE_TAG \
  ../

docker run \
  --workdir /github/workspace \
  --rm \
  --env PROJECT_PATH \
  --env BUILD_TARGET \
  --env BUILD_NAME \
  --env BUILDS_PATH \
  --env BUILD_METHOD \
  --env HOME \
  --env GITHUB_REF \
  --env GITHUB_SHA \
  --env GITHUB_REPOSITORY \
  --env GITHUB_ACTOR \
  --env GITHUB_WORKFLOW \
  --env GITHUB_HEAD_REF \
  --env GITHUB_BASE_REF \
  --env GITHUB_EVENT_NAME \
  --env GITHUB_WORKSPACE \
  --env GITHUB_ACTION \
  --env GITHUB_EVENT_PATH \
  --env RUNNER_OS \
  --env RUNNER_TOOL_CACHE \
  --env RUNNER_TEMP \
  --env RUNNER_WORKSPACE \
  --volume "/var/run/docker.sock":"/var/run/docker.sock" \
  --volume "/home/runner/work/_temp/_github_home":"/github/home" \
  --volume "/home/runner/work/_temp/_github_workflow":"/github/workflow" \
  --volume "${PWD}":"/github/workspace" \
  DOCKER_IMAGE_TAG
