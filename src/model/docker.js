import { exec } from '@actions/exec';

export default class Docker {
  static async build(buildParameters) {
    const { path = './', dockerfile, image } = buildParameters;
    const tag = `unity-builder:${image.tag}`;

    await exec('pwd');
    await exec('ls -alh');
    await exec(`ls -alh ${path}`);
    await exec(`
      docker build ${path}
        --file ${dockerfile}
        --build-arg IMAGE=${image}
        --tag ${tag}
    `);

    return tag;
  }

  static async run(image, parameters) {
    const { GITHUB_WORKSPACE } = process.env;
    const { projectPath, buildName, buildsPath, buildMethod } = parameters;

    await exec(`
      docker run \
        --workdir /github/workspace \
        --rm \
        --env PROJECT_PATH=${projectPath} \
        --env BUILD_TARGET=${image.targetPlatform} \
        --env BUILD_NAME=${buildName} \
        --env BUILDS_PATH=${buildsPath} \
        --env BUILD_METHOD=${buildMethod} \
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
        --volume "${GITHUB_WORKSPACE}":"/github/workspace" \
        ${image}
      `);
  }
}
