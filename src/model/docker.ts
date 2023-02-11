import { execWithErrorCheck } from './exec-with-error-check';
import ImageEnvironmentFactory from './image-environment-factory';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

class Docker {
  static async run(
    image,
    parameters,
    silent = false,
    overrideCommands = '',
    additionalVariables: any[] = [],
    options: any = false,
    entrypointBash: boolean = false,
  ) {
    let runCommand = '';
    switch (process.platform) {
      case 'linux':
        runCommand = this.getLinuxCommand(image, parameters, overrideCommands, additionalVariables, entrypointBash);
        break;
      case 'win32':
        runCommand = this.getWindowsCommand(image, parameters);
    }
    if (options !== false) {
      options.silent = silent;
      await execWithErrorCheck(runCommand, undefined, options);
    } else {
      await execWithErrorCheck(runCommand, undefined, { silent });
    }
  }

  static getLinuxCommand(
    image,
    parameters,
    overrideCommands = '',
    additionalVariables: any[] = [],
    entrypointBash: boolean = false,
  ): string {
    const { workspace, actionFolder, runnerTempPath, sshAgent, gitPrivateToken } = parameters;

    const githubHome = path.join(runnerTempPath, '_github_home');
    if (!existsSync(githubHome)) mkdirSync(githubHome);
    const githubWorkflow = path.join(runnerTempPath, '_github_workflow');
    if (!existsSync(githubWorkflow)) mkdirSync(githubWorkflow);
    const commandPrefix = image === `alpine` ? `/bin/sh` : `/bin/bash`;

    return `docker run \
            --workdir /github/workspace \
            --rm \
            ${ImageEnvironmentFactory.getEnvVarString(parameters, additionalVariables)} \
            --env UNITY_SERIAL \
            --env GITHUB_WORKSPACE=/github/workspace \
            ${gitPrivateToken ? `--env GIT_PRIVATE_TOKEN="${gitPrivateToken}"` : ''} \
            ${sshAgent ? '--env SSH_AUTH_SOCK=/ssh-agent' : ''} \
            --volume "${githubHome}":"/root:z" \
            --volume "${githubWorkflow}":"/github/workflow:z" \
            --volume "${workspace}":"/github/workspace:z" \
            --volume "${actionFolder}/default-build-script:/UnityBuilderAction:z" \
            --volume "${actionFolder}/platforms/ubuntu/steps:/steps:z" \
            --volume "${actionFolder}/platforms/ubuntu/entrypoint.sh:/entrypoint.sh:z" \
            --volume "${actionFolder}/unity-config:/usr/share/unity3d/config/:z" \
            ${sshAgent ? `--volume ${sshAgent}:/ssh-agent` : ''} \
            ${sshAgent ? '--volume /home/runner/.ssh/known_hosts:/root/.ssh/known_hosts:ro' : ''} \
            ${entrypointBash ? `--entrypoint ${commandPrefix}` : ``} \
            ${image} \
            ${entrypointBash ? `-c` : `${commandPrefix} -c`} \
            "${overrideCommands !== '' ? overrideCommands : `/entrypoint.sh`}"`;
  }

  static getWindowsCommand(image: any, parameters: any): string {
    const { workspace, actionFolder, unitySerial, gitPrivateToken } = parameters;

    return `docker run \
            --workdir c:/github/workspace \
            --rm \
            ${ImageEnvironmentFactory.getEnvVarString(parameters)} \
            --env UNITY_SERIAL="${unitySerial}" \
            --env GITHUB_WORKSPACE=c:/github/workspace \
            ${gitPrivateToken ? `--env GIT_PRIVATE_TOKEN="${gitPrivateToken}"` : ''} \
            --volume "${workspace}":"c:/github/workspace" \
            --volume "c:/regkeys":"c:/regkeys" \
            --volume "C:/Program Files (x86)/Microsoft Visual Studio":"C:/Program Files (x86)/Microsoft Visual Studio" \
            --volume "C:/Program Files (x86)/Windows Kits":"C:/Program Files (x86)/Windows Kits" \
            --volume "C:/ProgramData/Microsoft/VisualStudio":"C:/ProgramData/Microsoft/VisualStudio" \
            --volume "${actionFolder}/default-build-script":"c:/UnityBuilderAction" \
            --volume "${actionFolder}/platforms/windows":"c:/steps" \
            --volume "${actionFolder}/BlankProject":"c:/BlankProject" \
            ${image} \
            powershell c:/steps/entrypoint.ps1`;
  }
}

export default Docker;
