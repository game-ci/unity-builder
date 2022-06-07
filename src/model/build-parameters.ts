import { customAlphabet } from '../../../node_modules/nanoid';
import AndroidVersioning from './android-versioning.ts';
import CloudRunnerConstants from './cloud-runner/services/cloud-runner-constants.ts';
import CloudRunnerBuildGuid from './cloud-runner/services/cloud-runner-guid.ts';
import Input from './input.ts';
import Platform from './platform.ts';
import UnityVersioning from './unity-versioning.ts';
import Versioning from './versioning.ts';
import { GitRepoReader } from './input-readers/git-repo.ts';
import { GithubCliReader } from './input-readers/github-cli.ts';
import { Cli } from './cli/cli.ts';

class BuildParameters {
  public editorVersion!: string;
  public customImage!: string;
  public unitySerial!: string;
  public runnerTempPath: string | undefined;
  public targetPlatform!: string;
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
  public cloudRunnerCluster!: string;
  public awsBaseStackName!: string;
  public gitPrivateToken!: string;
  public awsStackName!: string;
  public kubeConfig!: string;
  public cloudRunnerMemory!: string;
  public cloudRunnerCpu!: string;
  public kubeVolumeSize!: string;
  public kubeVolume!: string;
  public kubeStorageClass!: string;
  public chownFilesTo!: string;
  public customJobHooks!: string;
  public cachePushOverrideCommand!: string;
  public cachePullOverrideCommand!: string;
  public readInputFromOverrideList!: string;
  public readInputOverrideCommand!: string;
  public checkDependencyHealthOverride!: string;
  public startDependenciesOverride!: string;
  public cacheKey!: string;

  public postBuildSteps!: string;
  public preBuildSteps!: string;
  public customJob!: string;
  public runNumber!: string;
  public branch!: string;
  public githubRepo!: string;
  public gitSha!: string;
  public logId!: string;
  public buildGuid!: string;
  public cloudRunnerBranch!: string;
  public cloudRunnerIntegrationTests!: boolean;
  public cloudRunnerBuilderPlatform!: string | undefined;
  public isCliMode!: boolean;

  static async create(): Promise<BuildParameters> {
    const buildFile = this.parseBuildFile(Input.buildName, Input.targetPlatform, Input.androidAppBundle);
    const editorVersion = UnityVersioning.determineUnityVersion(Input.projectPath, Input.unityVersion);
    const buildVersion = await Versioning.determineBuildVersion(Input.versioningStrategy, Input.specifiedVersion);
    const androidVersionCode = AndroidVersioning.determineVersionCode(buildVersion, Input.androidVersionCode);
    const androidSdkManagerParameters = AndroidVersioning.determineSdkManagerParameters(Input.androidTargetSdkVersion);

    // Todo - Don't use process.env directly, that's what the input model class is for.
    // ---
    let unitySerial = '';
    if (!process.env.UNITY_SERIAL && Input.githubInputEnabled) {
      // No serial was present, so it is a personal license that we need to convert
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

    return {
      editorVersion,
      customImage: Input.customImage,
      unitySerial,

      runnerTempPath: process.env.RUNNER_TEMP,
      targetPlatform: Input.targetPlatform,
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
      gitPrivateToken: Input.gitPrivateToken || (await GithubCliReader.GetGitHubAuthToken()),
      chownFilesTo: Input.chownFilesTo,
      cloudRunnerCluster: Input.cloudRunnerCluster,
      cloudRunnerBuilderPlatform: Input.cloudRunnerBuilderPlatform,
      awsBaseStackName: Input.awsBaseStackName,
      kubeConfig: Input.kubeConfig,
      cloudRunnerMemory: Input.cloudRunnerMemory,
      cloudRunnerCpu: Input.cloudRunnerCpu,
      kubeVolumeSize: Input.kubeVolumeSize,
      kubeVolume: Input.kubeVolume,
      postBuildSteps: Input.postBuildSteps,
      preBuildSteps: Input.preBuildSteps,
      customJob: Input.customJob,
      runNumber: Input.runNumber,
      branch: Input.branch.replace('/head', '') || (await GitRepoReader.GetBranch()),
      cloudRunnerBranch: Input.cloudRunnerBranch.split('/').reverse()[0],
      cloudRunnerIntegrationTests: Input.cloudRunnerTests,
      githubRepo: Input.githubRepo || (await GitRepoReader.GetRemote()) || 'game-ci/unity-builder',
      isCliMode: Cli.isCliMode,
      awsStackName: Input.awsBaseStackName,
      gitSha: Input.gitSha,
      logId: customAlphabet(CloudRunnerConstants.alphabet, 9)(),
      buildGuid: CloudRunnerBuildGuid.generateGuid(Input.runNumber, Input.targetPlatform),
      customJobHooks: Input.customJobHooks(),
      cachePullOverrideCommand: Input.cachePullOverrideCommand(),
      cachePushOverrideCommand: Input.cachePushOverrideCommand(),
      readInputOverrideCommand: Input.readInputOverrideCommand(),
      readInputFromOverrideList: Input.readInputFromOverrideList(),
      kubeStorageClass: Input.kubeStorageClass,
      checkDependencyHealthOverride: Input.checkDependencyHealthOverride,
      startDependenciesOverride: Input.startDependenciesOverride,
      cacheKey: Input.cacheKey,
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
