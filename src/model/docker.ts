import { exec } from '@actions/exec';
import { fstat } from 'fs';
import ImageTag from './image-tag';
const fs = require('fs');

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

    switch(process.platform)
    {
      case "linux":
        const linuxRunCommand = `docker run \
        --workdir /github/workspace \
        --rm \
        --env UNITY_LICENSE \
        --env UNITY_LICENSE_FILE \
        --env UNITY_EMAIL \
        --env UNITY_PASSWORD \
        --env UNITY_SERIAL \
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
        --env GITHUB_WORKSPACE=/github/workspace \
        --env GITHUB_ACTION \
        --env GITHUB_EVENT_PATH \
        --env RUNNER_OS \
        --env RUNNER_TOOL_CACHE \
        --env RUNNER_TEMP \
        --env RUNNER_WORKSPACE \
        --env GIT_PRIVATE_TOKEN="${gitPrivateToken}" \
        ${sshAgent ? '--env SSH_AUTH_SOCK=/ssh-agent' : ''} \
        --volume "/var/run/docker.sock":"/var/run/docker.sock" \
        --volume "${runnerTempPath}/_github_home":"/root" \
        --volume "${runnerTempPath}/_github_workflow":"/github/workflow" \
        --volume "${workspace}":"/github/workspace" \
        ${sshAgent ? `--volume ${sshAgent}:/ssh-agent` : ''} \
        ${sshAgent ? '--volume /home/runner/.ssh/known_hosts:/root/.ssh/known_hosts:ro' : ''} \
        ${image}`;

        await exec(linuxRunCommand, undefined, { silent });
        break;
      case "win32":
        var unitySerial = "";
        if (!process.env.UNITY_SERIAL)
        {
          //No serial was present so it is a personal license that we need to convert
          if (!process.env.UNITY_LICENSE)
          {
            throw new Error(`Missing Unity License File and no Serial was found. If this
                             is a personal license, make sure to follow the activation
                             steps and set the UNITY_LICENSE GitHub secret or enter a Unity
                             serial number inside the UNITY_SERIAL GitHub secret.`)
          }
          unitySerial = this.getSerialFromLicenseFile(process.env.UNITY_LICENSE);
        } else
        {
          unitySerial = process.env.UNITY_SERIAL!;
        }

        if (!(process.env.UNITY_EMAIL && process.env.UNITY_PASSWORD))
        {
          throw new Error(`Unity email and password must be set for windows based builds`);
        }

        await this.setupWindowsRun();

        this.validateWindowsPrereqs();

        const windowsRunCommand = `docker run \
        --workdir c:/github/workspace \
        --rm \
        --env UNITY_LICENSE \
        --env UNITY_LICENSE_FILE \
        --env UNITY_EMAIL \
        --env UNITY_PASSWORD \
        --env UNITY_SERIAL="${unitySerial}" \
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
        --env GITHUB_WORKSPACE=/github/workspace \
        --env GITHUB_ACTION \
        --env GITHUB_EVENT_PATH \
        --env RUNNER_OS \
        --env RUNNER_TOOL_CACHE \
        --env RUNNER_TEMP \
        --env RUNNER_WORKSPACE \
        --env GIT_PRIVATE_TOKEN="${gitPrivateToken}" \
        --volume "${runnerTempPath}/_github_home":"c:/root" \
        --volume "${runnerTempPath}/_github_workflow":"c:/github/workflow" \
        --volume "${workspace}":"c:/github/workspace" \
        --volume "c:/regkeys":"c:/regkeys" \
        --volume "C:/Program Files (x86)/Microsoft Visual Studio":"C:/Program Files (x86)/Microsoft Visual Studio" \
        --volume "C:/Program Files (x86)/Windows Kits":"C:/Program Files (x86)/Windows Kits" \
        --volume "C:/ProgramData/Microsoft/VisualStudio":"C:/ProgramData/Microsoft/VisualStudio" \
        ${image}`;

        await exec(windowsRunCommand, undefined, { silent });
        break;
      default:
        throw new Error(`Can't run docker on unsupported host platform`);
    }
  }

  //Setup prerequisite files for a windows-based docker run
  static async setupWindowsRun(silent = false) {
    //Need to export registry keys that point to the location of the windows 10 sdk
    const makeRegKeyFolderCommand = "mkdir c:/regkeys";
    await exec(makeRegKeyFolderCommand, undefined, {silent});
    const exportRegKeysCommand = "echo Y| reg export \"HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Microsoft SDKs\\Windows\\v10.0\" c:/regkeys/winsdk.reg";
    await exec(exportRegKeysCommand, undefined, {silent});
  }

  static validateWindowsPrereqs() {
    //Check for Visual Studio on runner
    if (!(fs.existsSync("C:/Program Files (x86)/Microsoft Visual Studio") && fs.existsSync("C:/ProgramData/Microsoft/VisualStudio")))
    {
      throw new Error(`Visual Studio Installation not found at default location.
                       Make sure the runner has Visual Studio installed in the
                       default location`);
    }

    //Check for Windows 10 SDK on runner
    if(!fs.existsSync("C:/Program Files (x86)/Windows Kits"))
    {
      throw new Error(`Windows 10 SDK not found in default location. Make sure
                       the runner has a Windows 10 SDK installed in the default 
                       location.`);
    }
  }

  static getSerialFromLicenseFile(license)
  {
    const startKey = `<DeveloperData Value="`;
    const endKey = `"/>`;
    let startIndex = license.indexOf(startKey) + startKey.length;
    if (startIndex < 0)
    {
      throw new Error(`License File was corrupted, unable to locate serial`);
    }
    let endIndex = license.indexOf(endKey, startIndex);
    //We substring off the first character as it is a garbage value
    return atob(license.substring(startIndex, endIndex)).substring(1);
  }
}

export default Docker;
