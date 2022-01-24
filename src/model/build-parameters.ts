import * as core from '@actions/core';
import AndroidVersioning from './android-versioning';
import Input from './input';
import Platform from './platform';
import UnityVersioning from './unity-versioning';
import Versioning from './versioning';

class BuildParameters {
  public version!: string;
  public customImage!: string;
  public unitySerial!: string;
  public runnerTempPath: string | undefined;
  public platform!: string;
  public projectPath!: string;
  public buildName!: string;
  public buildPath!: string;
  public buildFile!: string;
  public buildMethod!: string;
  public buildVersion!: string;
  public androidVersionCode!: string;
  public androidKeystoreName!: string;
  public androidKeystoreBase64!: string;
  public androidKeystorePass!: string;
  public androidKeyaliasName!: string;
  public androidKeyaliasPass!: string;
  public androidTargetSdkVersion!: string;
  public androidSdkManagerParameters!: string;
  public customParameters!: string;
  public sshAgent!: string;
  public gitPrivateToken!: string;
  public remoteBuildCluster!: string;
  public awsStackName!: string;
  public kubeConfig!: string;
  public githubToken!: string;
  public remoteBuildMemory!: string;
  public remoteBuildCpu!: string;
  public kubeVolumeSize!: string;
  public kubeVolume!: string;
  public chownFilesTo!: string;

  static async create(): Promise<BuildParameters> {
    const buildFile = this.parseBuildFile(Input.buildName, Input.targetPlatform, Input.androidAppBundle);

    const unityVersion = UnityVersioning.determineUnityVersion(Input.projectPath, Input.unityVersion);

    const buildVersion = await Versioning.determineVersion(Input.versioningStrategy, Input.specifiedVersion);

    const androidVersionCode = AndroidVersioning.determineVersionCode(buildVersion, Input.androidVersionCode);

    const androidSdkManagerParameters = AndroidVersioning.determineSdkManagerParameters(Input.androidTargetSdkVersion);

    let unitySerial = '';
    if (!process.env.UNITY_SERIAL) {
      //No serial was present so it is a personal license that we need to convert
      if (!process.env.UNITY_LICENSE) {
        throw new Error(`Missing Unity License File and no Serial was found. If this
                          is a personal license, make sure to follow the activation
                          steps and set the UNITY_LICENSE GitHub secret or enter a Unity
                          serial number inside the UNITY_SERIAL GitHub secret.`);
      }
      unitySerial = this.getSerialFromLicenseFile(process.env.UNITY_LICENSE);
    } else {
      unitySerial = process.env.UNITY_SERIAL!;
    }
    core.setSecret(unitySerial);

    return {
      version: unityVersion,
      customImage: Input.customImage,
      unitySerial,

      runnerTempPath: process.env.RUNNER_TEMP,
      platform: Input.targetPlatform,
      projectPath: Input.projectPath,
      buildName: Input.buildName,
      buildPath: `${Input.buildsPath}/${Input.targetPlatform}`,
      buildFile,
      buildMethod: Input.buildMethod,
      buildVersion,
      androidVersionCode,
      androidKeystoreName: Input.androidKeystoreName,
      androidKeystoreBase64: Input.androidKeystoreBase64,
      androidKeystorePass: Input.androidKeystorePass,
      androidKeyaliasName: Input.androidKeyaliasName,
      androidKeyaliasPass: Input.androidKeyaliasPass,
      androidTargetSdkVersion: Input.androidTargetSdkVersion,
      androidSdkManagerParameters,
      customParameters: Input.customParameters,
      sshAgent: Input.sshAgent,
      gitPrivateToken: Input.gitPrivateToken,
      chownFilesTo: Input.chownFilesTo,
      remoteBuildCluster: Input.remoteBuildCluster,
      awsStackName: Input.awsStackName,
      kubeConfig: Input.kubeConfig,
      githubToken: Input.githubToken,
      remoteBuildMemory: Input.remoteBuildMemory,
      remoteBuildCpu: Input.remoteBuildCpu,
      kubeVolumeSize: Input.kubeVolumeSize,
      kubeVolume: Input.kubeVolume,
    };
  }

  static parseBuildFile(filename, platform, androidAppBundle) {
    if (Platform.isWindows(platform)) {
      return `${filename}.exe`;
    }

    if (Platform.isAndroid(platform)) {
      return androidAppBundle ? `${filename}.aab` : `${filename}.apk`;
    }

    return filename;
  }

  static getSerialFromLicenseFile(license) {
    const startKey = `<DeveloperData Value="`;
    const endKey = `"/>`;
    const startIndex = license.indexOf(startKey) + startKey.length;
    if (startIndex < 0) {
      throw new Error(`License File was corrupted, unable to locate serial`);
    }
    const endIndex = license.indexOf(endKey, startIndex);
    // Slice off the first 4 characters as they are garbage values
    return Buffer.from(license.slice(startIndex, endIndex), 'base64').toString('binary').slice(4);
  }
}

export default BuildParameters;
