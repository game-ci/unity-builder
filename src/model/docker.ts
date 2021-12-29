import { exec } from '@actions/exec';
import ImageTag from './image-tag';
import ImageEnvironmentFactory from './image-environment-factory';

class Docker {
  static async build(buildParameters, silent = false) {
    const { path, dockerfile, baseImage } = buildParameters;
    const { version, platform } = baseImage;

    const tag = new ImageTag({ repository: '', name: 'unity-builder', version, platform });
    const command = `docker build ${path} \
      --file ${dockerfile} \
      --build-arg IMAGE=${baseImage} \
      --tag ${tag}`;

    await exec(command, undefined, { silent });

    return tag;
  }

  static async run(image, parameters, silent = false) {
    const { workspace, runnerTempPath, sshAgent } = parameters;

    const command = `docker run \
        --workdir /github/workspace \
        --rm \
        ${ImageEnvironmentFactory.getEnvVarString(parameters)} \
        --volume "/var/run/docker.sock":"/var/run/docker.sock" \
        --volume "${runnerTempPath}/_github_home":"/root" \
        --volume "${runnerTempPath}/_github_workflow":"/github/workflow" \
        --volume "${workspace}":"/github/workspace" \
        ${sshAgent ? `--volume ${sshAgent}:/ssh-agent` : ''} \
        ${sshAgent ? '--volume /home/runner/.ssh/known_hosts:/root/.ssh/known_hosts:ro' : ''} \
        ${image}`;

    await exec(command, undefined, { silent });
  }
}

export default Docker;
