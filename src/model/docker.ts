import { exec } from '@actions/exec';
import ImageTag from './image-tag';
import ImageEnvironmentFactory from './image-environment-factory';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

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
        const github_home = join(runnerTemporaryPath, '_github_home');
        if (!existsSync(github_home)) mkdirSync(github_home);
        const github_workflow = join(runnerTemporaryPath, '_github_workflow');
        if (!existsSync(github_workflow)) mkdirSync(github_workflow);

        return `--env UNITY_SERIAL \
                --env GITHUB_WORKSPACE=/github/workspace \
                ${sshAgent ? '--env SSH_AUTH_SOCK=/ssh-agent' : ''} \
                --volume "/var/run/docker.sock":"/var/run/docker.sock:z" \
                --volume "${github_home}":"/root:z" \
                --volume "${github_workflow}":"/github/workflow:z" \
                --volume "${workspace}":"/github/workspace:z" \
                ${sshAgent ? `--volume ${sshAgent}:/ssh-agent` : ''} \
                ${sshAgent ? '--volume /home/runner/.ssh/known_hosts:/root/.ssh/known_hosts:ro' : ''}`;
      case 'win32':
        return `--env UNITY_SERIAL="${unitySerial}" \
                --env GITHUB_WORKSPACE=c:/github/workspace \
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
