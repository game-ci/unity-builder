#!/bin/sh

#
# Input variables
#

IMAGE_UNITY_VERSION=$1
IMAGE_TARGET_PLATFORM=$2
PROJECT_PATH=$3
TARGET_PLATFORM=$4
BUILD_NAME=$5
BUILDS_PATH=$6
BUILD_METHOD=$7

#
# Default variables
#

# PROJECT_PATH = test-project
# BUILD_TARGET =
# BUILD_NAME =
# BUILDS_PATH =
# BUILD_METHOD =
# HOME = /home/runner
# GITHUB_REF = refs/pull/8/merge
# GITHUB_SHA = 0e697e1f2d80e0e8505c0e0dcff76d24bc7a4f36
# GITHUB_REPOSITORY = webbertakken/unity-builder
# GITHUB_ACTOR = webbertakken
# GITHUB_WORKFLOW = Actions 😎
# GITHUB_HEAD_REF = prepare-for-multi-target
# GITHUB_BASE_REF = master
# GITHUB_EVENT_NAME = pull_request
# GITHUB_WORKSPACE = /home/runner/work/unity-builder/unity-builder
# GITHUB_ACTION = self
# GITHUB_EVENT_PATH = /home/runner/work/_temp/_github_workflow/event.json
# RUNNER_OS = Linux
# RUNNER_TOOL_CACHE = /opt/hostedtoolcache
# RUNNER_TEMP = /home/runner/work/_temp
# RUNNER_WORKSPACE = /home/runner/work/unity-builder

#
# Internal variables
#

ACTION_ROOT=$(dirname $(dirname $(readlink -fm "$0")))
DOCKER_IMAGE_TAG=unity-builder:$IMAGE_UNITY_VERSION-$IMAGE_TARGET_PLATFORM

# TODO - Remove debug statements (after it is proven to work)

echo "Listing ACTION_ROOT"
ls $ACTION_ROOT
echo ""
echo "Listing GITHUB_WORKSPACE"
ls $GITHUB_WORKSPACE
echo ""
echo "Listing RUNNER_WORKSPACE"
ls $RUNNER_WORKSPACE
echo ""

#
# Build image
#
echo "some test"

echo "Building docker image for $IMAGE_UNITY_VERSION-$IMAGE_TARGET_PLATFORM"
docker build $GITHUB_WORKSPACE \
  --file $ACTION_ROOT/Dockerfile \
  --build-arg IMAGE_REPOSITORY=gableroux \
  --build-arg IMAGE_NAME=unity3d \
  --build-arg IMAGE_VERSION=$IMAGE_UNITY_VERSION-$IMAGE_TARGET_PLATFORM \
  --tag $DOCKER_IMAGE_TAG

#
# Run specified container
#

docker run \
  --workdir /github/workspace \
  --rm \
  --env PROJECT_PATH \
  --env BUILD_TARGET=$TARGET_PLATFORM \
  --env BUILD_NAME \
  --env BUILDS_PATH \
  --env BUILD_METHOD \
  --env HOME=/github/home \
  --env GITHUB_REF \
  --env GITHUB_SHA \
  --env GITHUB_REPOSITORY \
  --env GITHUB_ACTOR \
  --env GITHUB_WORKFLOW \
  --env GITHUB_HEAD_REF \
  --env GITHUB_BASE_REF \
  --env GITHUB_EVENT_NAME \
  --env GITHUB_WORKSPACE=/github/workspace \
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
  $DOCKER_IMAGE_TAG
