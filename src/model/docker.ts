import ImageEnvironmentFactory from './image-environment-factory.ts';
import { path, fsSync as fs } from '../dependencies.ts';
import System from './system.ts';

class Docker {
  static async run(image, parameters, silent = false) {
    log.warning('running docker process for', process.platform, silent);
    let command = '';
    switch (process.platform) {
      case 'linux':
        command = await this.getLinuxCommand(image, parameters);
        break;
      case 'win32':
        command = await this.getWindowsCommand(image, parameters);
    }

    const test = await System.newRun(`docker`, command.replace(/\s\s+/, ' ').split(' '), { silent, verbose: true });
    log.error('test', test);
  }

  static async getLinuxCommand(image, parameters): string {
    const { workspace, actionFolder, runnerTempPath, sshAgent, gitPrivateToken } = parameters;

    const githubHome = path.join(runnerTempPath, '_github_home');
    await fs.ensureDir(githubHome);
    const githubWorkflow = path.join(runnerTempPath, '_github_workflow');
    await fs.ensureDir(githubWorkflow);

    return String.dedent`
      docker run \
        --workdir /github/workspace \
        --rm \
        ${ImageEnvironmentFactory.getEnvVarString(parameters)} \
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
        ${sshAgent ? `--volume ${sshAgent}:/ssh-agent` : ''} \
        ${sshAgent ? '--volume /home/runner/.ssh/known_hosts:/root/.ssh/known_hosts:ro' : ''} \
        ${image} \
        /bin/bash -c /entrypoint.sh
    `;
  }

  static async getWindowsCommand(image: any, parameters: any): string {
    const { workspace, actionFolder, unitySerial, gitPrivateToken, cliStoragePath } = parameters;

    // Todo - get this to work on a non-github runner local machine
    // Note: difference between `docker run` and `run`
    return String.dedent`run ${image} powershell c:/steps/entrypoint.ps1`;
    return String.dedent`
      docker run \
        --workdir /github/workspace \
        --rm \
        ${ImageEnvironmentFactory.getEnvVarString(parameters)} \
        --env UNITY_SERIAL="${unitySerial}" \
        --env GITHUB_WORKSPACE=c:/github/workspace \
        ${gitPrivateToken ? `--env GIT_PRIVATE_TOKEN="${gitPrivateToken}"` : ''} \
        --volume "${workspace}":"c:/github/workspace" \
        --volume "${cliStoragePath}/registry-keys":"c:/registry-keys" \
        --volume "C:/Program Files (x86)/Microsoft Visual Studio":"C:/Program Files (x86)/Microsoft Visual Studio" \
        --volume "C:/Program Files (x86)/Windows Kits":"C:/Program Files (x86)/Windows Kits" \
        --volume "C:/ProgramData/Microsoft/VisualStudio":"C:/ProgramData/Microsoft/VisualStudio" \
        --volume "${actionFolder}/default-build-script":"c:/UnityBuilderAction" \
        --volume "${actionFolder}/platforms/windows":"c:/steps" \
        --volume "${actionFolder}/BlankProject":"c:/BlankProject" \
        ${image} \
        powershell c:/steps/entrypoint.ps1
    `;
  }
}

export default Docker;
