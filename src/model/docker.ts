import ImageEnvironmentFactory from './image-environment-factory.ts';
import { path, fsSync as fs } from '../dependencies.ts';
import System from './system/system.ts';

class Docker {
  static async run(image, parameters) {
    log.warning('running docker process for', process.platform);
    let command = '';
    switch (Deno.build.os) {
      case 'windows': {
        // Todo: check if docker daemon is set for Windows or Linux containers.
        command = await this.getWindowsCommand(image, parameters);
        break;
      }
      case 'linux':
      case 'darwin': {
        command = await this.getLinuxCommand(image, parameters);
        break;
      }
    }

    try {
      const test = await System.run(command, { attach: true });
      log.warning('test', test);
    } catch (error) {
      if (error.message.includes('docker: image operating system "windows" cannot be used on this platform')) {
        throw new Error(String.dedent`
          Docker daemon is not set to run Windows containers.

          To enable the Hyper-V container backend run:
            Enable-WindowsOptionalFeature -Online -FeatureName $("Microsoft-Hyper-V", "Containers") -All

          To switch the docker daemon to run Windows containers run:
            & $Env:ProgramFiles\\Docker\\Docker\\DockerCli.exe -SwitchDaemon .

          For more information see:
            https://docs.microsoft.com/en-us/virtualization/windowscontainers/quick-start/set-up-environment?tabs=dockerce#prerequisites
        `);
      }

      throw error;
    }
  }

  static async getLinuxCommand(image, parameters): string {
    const { workspace, actionFolder, runnerTempPath, sshAgent, gitPrivateToken } = parameters;

    const githubHome = path.join(runnerTempPath, '_github_home');
    await fs.ensureDir(githubHome);
    const githubWorkflow = path.join(runnerTempPath, '_github_workflow');
    await fs.ensureDir(githubWorkflow);

    return String.dedent`
      docker run \
        --rm \
        --workdir /github/workspace \
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

    // Note: the equals sign (=) is needed in Powershell.
    return String.dedent`
      docker run \
        --rm \
        --workdir="c:/github/workspace" \
        ${ImageEnvironmentFactory.getEnvVarString(parameters)} \
        --env UNITY_SERIAL="${unitySerial}" \
        --env GITHUB_WORKSPACE=c:/github/workspace \
        --env GIT_PRIVATE_TOKEN="${gitPrivateToken}" \
        --volume="${workspace}":"c:/github/workspace" \
        --volume="${cliStoragePath}/registry-keys":"c:/registry-keys" \
        --volume="C:/Program Files (x86)/Microsoft Visual Studio":"C:/Program Files (x86)/Microsoft Visual Studio" \
        --volume="C:/Program Files (x86)/Windows Kits":"C:/Program Files (x86)/Windows Kits" \
        --volume="C:/ProgramData/Microsoft/VisualStudio":"C:/ProgramData/Microsoft/VisualStudio" \
        --volume="${actionFolder}/default-build-script":"c:/UnityBuilderAction" \
        --volume="${actionFolder}/platforms/windows":"c:/steps" \
        --volume="${actionFolder}/BlankProject":"c:/BlankProject" \
        ${image} \
        powershell c:/steps/entrypoint.ps1
    `;
  }
}

export default Docker;
