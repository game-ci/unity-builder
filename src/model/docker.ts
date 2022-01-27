import { exec } from '@actions/exec';
import ImageTag from './image-tag';

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
    const {
      version,
      workspace,
      unitySerial,
      runnerTempPath,
      platform,
      projectPath,
      buildName,
      buildPath,
      buildFile,
      buildMethod,
      buildVersion,
      androidVersionCode,
      androidKeystoreName,
      androidKeystoreBase64,
      androidKeystorePass,
      androidKeyaliasName,
      androidKeyaliasPass,
      androidTargetSdkVersion,
      androidSdkManagerParameters,
      customParameters,
      sshAgent,
      gitPrivateToken,
      chownFilesTo,
    } = parameters;

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
    --env UNITY_LICENSE \
    --env UNITY_LICENSE_FILE \
    --env UNITY_EMAIL \
    --env UNITY_PASSWORD \
    --env UNITY_VERSION="${version}" \
    --env USYM_UPLOAD_AUTH_TOKEN \
    --env PROJECT_PATH="${projectPath}" \
    --env BUILD_TARGET="${platform}" \
    --env BUILD_NAME="${buildName}" \
    --env BUILD_PATH="${buildPath}" \
    --env BUILD_FILE="${buildFile}" \
    --env BUILD_METHOD="${buildMethod}" \
    --env VERSION="${buildVersion}" \
    --env ANDROID_VERSION_CODE="${androidVersionCode}" \
    --env ANDROID_KEYSTORE_NAME="${androidKeystoreName}" \
    --env ANDROID_KEYSTORE_BASE64="${androidKeystoreBase64}" \
    --env ANDROID_KEYSTORE_PASS="${androidKeystorePass}" \
    --env ANDROID_KEYALIAS_NAME="${androidKeyaliasName}" \
    --env ANDROID_KEYALIAS_PASS="${androidKeyaliasPass}" \
    --env ANDROID_TARGET_SDK_VERSION="${androidTargetSdkVersion}" \
    --env ANDROID_SDK_MANAGER_PARAMETERS="${androidSdkManagerParameters}" \
    --env CUSTOM_PARAMETERS="${customParameters}" \
    --env CHOWN_FILES_TO="${chownFilesTo}" \
    --env GITHUB_REF \
    --env GITHUB_SHA \
    --env GITHUB_REPOSITORY \
    --env GITHUB_ACTOR \
    --env GITHUB_WORKFLOW \
    --env GITHUB_HEAD_REF \
    --env GITHUB_BASE_REF \
    --env GITHUB_EVENT_NAME \
    --env GITHUB_ACTION \
    --env GITHUB_EVENT_PATH \
    --env RUNNER_OS \
    --env RUNNER_TOOL_CACHE \
    --env RUNNER_TEMP \
    --env RUNNER_WORKSPACE \
    --env GIT_PRIVATE_TOKEN="${gitPrivateToken}" \
    ${baseOsSpecificArguments} \
    ${image}`;

    await exec(runCommand, undefined, { silent });
  }

  static getBaseOsSpecificArguments(baseOs, workspace, unitySerial, runnerTemporaryPath, sshAgent): string {
    switch (baseOs) {
      case 'linux':
        return `--env UNITY_SERIAL \
                --env GITHUB_WORKSPACE=/github/workspace \
                ${sshAgent ? '--env SSH_AUTH_SOCK=/ssh-agent' : ''} \
                --volume "/var/run/docker.sock":"/var/run/docker.sock" \
                --volume "${runnerTemporaryPath}/_github_home":"/root" \
                --volume "${runnerTemporaryPath}/_github_workflow":"/github/workflow" \
                --volume "${workspace}":"/github/workspace" \
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
