import ImageEnvironmentFactory from './image-environment-factory.ts';
import { path, exec, fs } from '../dependencies.ts';

class Docker {
  static async run(image, parameters, silent = false) {
    let runCommand = '';
    switch (process.platform) {
      case 'linux':
        runCommand = this.getLinuxCommand(image, parameters);
        break;
      case 'win32':
        runCommand = this.getWindowsCommand(image, parameters);
    }
    await exec(runCommand, undefined, { silent });
  }

  static getLinuxCommand(image, parameters): string {
    const { workspace, actionFolder, runnerTempPath, sshAgent, gitPrivateToken } = parameters;

    const githubHome = path.join(runnerTempPath, '_github_home');
    if (!fs.existsSync(githubHome)) fs.mkdirSync(githubHome);
    const githubWorkflow = path.join(runnerTempPath, '_github_workflow');
    if (!fs.existsSync(githubWorkflow)) fs.mkdirSync(githubWorkflow);

    return `docker run \
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
            /bin/bash -c /entrypoint.sh`;
  }

  static getWindowsCommand(image: any, parameters: any): string {
    const { workspace, actionFolder, unitySerial, gitPrivateToken } = parameters;

    return `docker run \
            --workdir /github/workspace \
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
