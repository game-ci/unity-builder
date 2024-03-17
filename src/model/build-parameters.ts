import { customAlphabet } from 'nanoid';
import AndroidVersioning from './android-versioning';
import CloudRunnerConstants from './cloud-runner/options/cloud-runner-constants';
import CloudRunnerBuildGuid from './cloud-runner/options/cloud-runner-guid';
import Input from './input';
import Platform from './platform';
import UnityVersioning from './unity-versioning';
import Versioning from './versioning';
import { GitRepoReader } from './input-readers/git-repo';
import { GithubCliReader } from './input-readers/github-cli';
import { Cli } from './cli/cli';
import GitHub from './github';
import CloudRunnerOptions from './cloud-runner/options/cloud-runner-options';
import CloudRunner from './cloud-runner/cloud-runner';
import * as core from '@actions/core';

class BuildParameters {
  // eslint-disable-next-line no-undef
  [key: string]: any;

  public editorVersion!: string;
  public customImage!: string;
  public unitySerial!: string;
  public unityLicensingServer!: string;
  public skipActivation!: string;
  public runnerTempPath!: string;
  public targetPlatform!: string;
  public projectPath!: string;
  public buildName!: string;
  public buildPath!: string;
  public buildFile!: string;
  public buildMethod!: string;
  public buildVersion!: string;
  public manualExit!: boolean;
  public enableGpu!: boolean;
  public androidVersionCode!: string;
  public androidKeystoreName!: string;
  public androidKeystoreBase64!: string;
  public androidKeystorePass!: string;
  public androidKeyaliasName!: string;
  public androidKeyaliasPass!: string;
  public androidTargetSdkVersion!: string;
  public androidSdkManagerParameters!: string;
  public androidExportType!: string;
  public androidSymbolType!: string;
  public dockerCpuLimit!: string;
  public dockerMemoryLimit!: string;
  public dockerIsolationMode!: string;
  public containerRegistryRepository!: string;
  public containerRegistryImageVersion!: string;

  public customParameters!: string;
  public sshAgent!: string;
  public sshPublicKeysDirectoryPath!: string;
  public providerStrategy!: string;
  public gitPrivateToken!: string;
  public awsStackName!: string;
  public kubeConfig!: string;
  public containerMemory!: string;
  public containerCpu!: string;
  public kubeVolumeSize!: string;
  public kubeVolume!: string;
  public kubeStorageClass!: string;
  public runAsHostUser!: string;
  public chownFilesTo!: string;
  public commandHooks!: string;
  public pullInputList!: string[];
  public inputPullCommand!: string;
  public cacheKey!: string;

  public postBuildContainerHooks!: string;
  public preBuildContainerHooks!: string;
  public customJob!: string;
  public runNumber!: string;
  public branch!: string;
  public githubRepo!: string;
  public gitSha!: string;
  public logId!: string;
  public buildGuid!: string;
  public cloudRunnerBranch!: string;
  public cloudRunnerDebug!: boolean | undefined;
  public buildPlatform!: string | undefined;
  public isCliMode!: boolean;
  public maxRetainedWorkspaces!: number;
  public useLargePackages!: boolean;
  public useCompressionStrategy!: boolean;
  public garbageMaxAge!: number;
  public githubChecks!: boolean;
  public asyncWorkflow!: boolean;
  public githubCheckId!: string;
  public finalHooks!: string[];
  public skipLfs!: boolean;
  public skipCache!: boolean;
  public cacheUnityInstallationOnMac!: boolean;
  public unityHubVersionOnMac!: string;
  public dockerWorkspacePath!: string;

  public static shouldUseRetainedWorkspaceMode(buildParameters: BuildParameters) {
    return buildParameters.maxRetainedWorkspaces > 0 && CloudRunner.lockedWorkspace !== ``;
  }

  static async create(): Promise<BuildParameters> {
    const buildFile = this.parseBuildFile(Input.buildName, Input.targetPlatform, Input.androidExportType);
    const editorVersion = UnityVersioning.determineUnityVersion(Input.projectPath, Input.unityVersion);
    const buildVersion = await Versioning.determineBuildVersion(Input.versioningStrategy, Input.specifiedVersion);
    const androidVersionCode = AndroidVersioning.determineVersionCode(buildVersion, Input.androidVersionCode);
    const androidSdkManagerParameters = AndroidVersioning.determineSdkManagerParameters(Input.androidTargetSdkVersion);

    const androidSymbolExportType = Input.androidSymbolType;
    if (Platform.isAndroid(Input.targetPlatform)) {
      switch (androidSymbolExportType) {
        case 'none':
        case 'public':
        case 'debugging':
          break;
        default:
          throw new Error(
            `Invalid androidSymbolType: ${Input.androidSymbolType}. Must be one of: none, public, debugging`,
          );
      }
    }

    let unitySerial = '';
    if (Input.unityLicensingServer === '') {
      if (!Input.unitySerial && GitHub.githubInputEnabled) {
        // No serial was present, so it is a personal license that we need to convert
        if (!Input.unityLicense) {
          throw new Error(
            `Missing Unity License File and no Serial was found. If this
                            is a personal license, make sure to follow the activation
                            steps and set the UNITY_LICENSE GitHub secret or enter a Unity
                            serial number inside the UNITY_SERIAL GitHub secret.`,
          );
        }
        unitySerial = this.getSerialFromLicenseFile(Input.unityLicense);
      } else {
        unitySerial = Input.unitySerial!;
      }
    }

    if (unitySerial !== undefined && unitySerial.length === 27) {
      core.setSecret(unitySerial);
      core.setSecret(`${unitySerial.slice(0, -4)}XXXX`);
    }

    return {
      editorVersion,
      customImage: Input.customImage,
      unitySerial,
      unityLicensingServer: Input.unityLicensingServer,
      skipActivation: Input.skipActivation,
      runnerTempPath: Input.runnerTempPath,
      targetPlatform: Input.targetPlatform,
      projectPath: Input.projectPath,
      buildName: Input.buildName,
      buildPath: `${Input.buildsPath}/${Input.targetPlatform}`,
      buildFile,
      buildMethod: Input.buildMethod,
      buildVersion,
      manualExit: Input.manualExit,
      enableGpu: Input.enableGpu,
      androidVersionCode,
      androidKeystoreName: Input.androidKeystoreName,
      androidKeystoreBase64: Input.androidKeystoreBase64,
      androidKeystorePass: Input.androidKeystorePass,
      androidKeyaliasName: Input.androidKeyaliasName,
      androidKeyaliasPass: Input.androidKeyaliasPass,
      androidTargetSdkVersion: Input.androidTargetSdkVersion,
      androidSdkManagerParameters,
      androidExportType: Input.androidExportType,
      androidSymbolType: androidSymbolExportType,
      customParameters: Input.customParameters,
      sshAgent: Input.sshAgent,
      sshPublicKeysDirectoryPath: Input.sshPublicKeysDirectoryPath,
      gitPrivateToken: Input.gitPrivateToken ?? (await GithubCliReader.GetGitHubAuthToken()),
      runAsHostUser: Input.runAsHostUser,
      chownFilesTo: Input.chownFilesTo,
      dockerCpuLimit: Input.dockerCpuLimit,
      dockerMemoryLimit: Input.dockerMemoryLimit,
      dockerIsolationMode: Input.dockerIsolationMode,
      containerRegistryRepository: Input.containerRegistryRepository,
      containerRegistryImageVersion: Input.containerRegistryImageVersion,
      providerStrategy: CloudRunnerOptions.providerStrategy,
      buildPlatform: CloudRunnerOptions.buildPlatform,
      kubeConfig: CloudRunnerOptions.kubeConfig,
      containerMemory: CloudRunnerOptions.containerMemory,
      containerCpu: CloudRunnerOptions.containerCpu,
      kubeVolumeSize: CloudRunnerOptions.kubeVolumeSize,
      kubeVolume: CloudRunnerOptions.kubeVolume,
      postBuildContainerHooks: CloudRunnerOptions.postBuildContainerHooks,
      preBuildContainerHooks: CloudRunnerOptions.preBuildContainerHooks,
      customJob: CloudRunnerOptions.customJob,
      runNumber: Input.runNumber,
      branch: Input.branch.replace('/head', '') || (await GitRepoReader.GetBranch()),
      cloudRunnerBranch: CloudRunnerOptions.cloudRunnerBranch.split('/').reverse()[0],
      cloudRunnerDebug: CloudRunnerOptions.cloudRunnerDebug,
      githubRepo: (Input.githubRepo ?? (await GitRepoReader.GetRemote())) || 'game-ci/unity-builder',
      isCliMode: Cli.isCliMode,
      awsStackName: CloudRunnerOptions.awsStackName,
      gitSha: Input.gitSha,
      logId: customAlphabet(CloudRunnerConstants.alphabet, 9)(),
      buildGuid: CloudRunnerBuildGuid.generateGuid(Input.runNumber, Input.targetPlatform),
      commandHooks: CloudRunnerOptions.commandHooks,
      inputPullCommand: CloudRunnerOptions.inputPullCommand,
      pullInputList: CloudRunnerOptions.pullInputList,
      kubeStorageClass: CloudRunnerOptions.kubeStorageClass,
      cacheKey: CloudRunnerOptions.cacheKey,
      maxRetainedWorkspaces: Number.parseInt(CloudRunnerOptions.maxRetainedWorkspaces),
      useLargePackages: CloudRunnerOptions.useLargePackages,
      useCompressionStrategy: CloudRunnerOptions.useCompressionStrategy,
      garbageMaxAge: CloudRunnerOptions.garbageMaxAge,
      githubChecks: CloudRunnerOptions.githubChecks,
      asyncWorkflow: CloudRunnerOptions.asyncCloudRunner,
      githubCheckId: CloudRunnerOptions.githubCheckId,
      finalHooks: CloudRunnerOptions.finalHooks,
      skipLfs: CloudRunnerOptions.skipLfs,
      skipCache: CloudRunnerOptions.skipCache,
      cacheUnityInstallationOnMac: Input.cacheUnityInstallationOnMac,
      unityHubVersionOnMac: Input.unityHubVersionOnMac,
      dockerWorkspacePath: Input.dockerWorkspacePath,
    };
  }

  static parseBuildFile(filename: string, platform: string, androidExportType: string): string {
    if (Platform.isWindows(platform)) {
      return `${filename}.exe`;
    }

    if (Platform.isAndroid(platform)) {
      switch (androidExportType) {
        case `androidPackage`:
          return `${filename}.apk`;
        case `androidAppBundle`:
          return `${filename}.aab`;
        case `androidStudioProject`:
          return filename;
        default:
          throw new Error(
            `Unknown Android Export Type: ${androidExportType}. Must be one of androidPackage for apk, androidAppBundle for aab, androidStudioProject for android project`,
          );
      }
    }

    return filename;
  }

  static getSerialFromLicenseFile(license: string) {
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
