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
    const { workspace, unitySerial, runnerTempPath, sshAgent } = parameters;

    const baseOsSpecificArguments = this.getBaseOsSpecificArguments(
      process.platform,
      workspace,
      unitySerial,
      runnerTempPath,
      sshAgent,
    );

    const runCommand = `docker run \
    --workdir /github/workspace \
    --rm \
    ${ImageEnvironmentFactory.getEnvVarString(parameters)} \
    ${baseOsSpecificArguments} \
    ${image}`;

    await exec(runCommand, undefined, { silent });
  }

  static getBaseOsSpecificArguments(baseOs, workspace, unitySerial, runnerTemporaryPath, sshAgent): string {
    switch (baseOs) {
      case 'linux':
        return `--env UNITY_SERIAL \
                ${sshAgent ? '--env SSH_AUTH_SOCK=/ssh-agent' : ''} \
                --volume "/var/run/docker.sock":"/var/run/docker.sock" \
                --volume "${runnerTemporaryPath}/_github_home":"/root" \
                --volume "${runnerTemporaryPath}/_github_workflow":"/github/workflow" \
                --volume "${workspace}":"/github/workspace" \
                ${sshAgent ? `--volume ${sshAgent}:/ssh-agent` : ''} \
                ${sshAgent ? '--volume /home/runner/.ssh/known_hosts:/root/.ssh/known_hosts:ro' : ''}`;
      case 'win32':
        return `--env UNITY_SERIAL="${unitySerial}" \
                --volume "${workspace}":"c:/github/workspace" \
                --volume "c:/regkeys":"c:/regkeys" \
                --volume "C:/Program Files (x86)/Microsoft Visual Studio":"C:/Program Files (x86)/Microsoft Visual Studio" \
                --volume "C:/Program Files (x86)/Windows Kits":"C:/Program Files (x86)/Windows Kits" \
                --volume "C:/ProgramData/Microsoft/VisualStudio":"C:/ProgramData/Microsoft/VisualStudio"`;
      //Note: When upgrading to Server 2022, we will need to move to just "program files" since VS will be 64-bit
    }
    return '';
  }
}

export default Docker;
