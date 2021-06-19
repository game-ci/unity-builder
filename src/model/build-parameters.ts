import AndroidVersioning from './android-versioning';
import Input from './input';
import Platform from './platform';
import UnityVersioning from './unity-versioning';
import Versioning from './versioning';

class BuildParameters {
  public version!: string;
  public customImage!: string;
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
  public customParameters!: string;
  public sshAgent!: string;
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

    return {
      version: unityVersion,
      customImage: Input.customImage,

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
      customParameters: Input.customParameters,
      sshAgent: Input.sshAgent,
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
}

export default BuildParameters;
