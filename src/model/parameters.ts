import Input from './input.ts';
import BuildVersionGenerator from '../middleware/build-versioning/build-version-generator.ts';
import { GitRepoReader } from './input-readers/git-repo.ts';
import { CommandInterface } from '../command/command-interface.ts';
import { Environment } from '../core/env/environment.ts';
import { Parameter } from './parameter.ts';

class Parameters {
  private command: CommandInterface;
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

  private defaults: Partial<Parameters> = {
    region: 'eu-west-2',
  };

  private readonly input: Input;
  private readonly env: Environment;

  constructor(input: Input, env: Environment) {
    this.input = input;
    this.env = env;

    // Todo - ~/.gameci should hold a config with default settings, like cloud region = 'eu-west-2'
    // this.config = config;
  }

  public get(query, useDefault = true) {
    const defaultValue = useDefault ? this.default(query) : undefined;
    const value = this.input.get(query) || this.env.get(Parameter.toUpperSnakeCase(query)) || defaultValue;

    if (log.isVeryVerbose) log.debug('Argument:', query, '=', value);

    return value;
  }

  private default(query) {
    return this.defaults[query];
  }

  public async parse(): Promise<Parameters> {
    const branch = (await BuildVersionGenerator.getCurrentBranch()) || (await GitRepoReader.GetBranch());

    const parameters = {
      branch,
      unitySerial: this.getUnitySerial(),
      editorVersion: engineVersion,
      runnerTempPath: this.env.get('RUNNER_TEMP'),
      buildName,
      buildPath,
      buildFile,
      buildMethod: this.input.buildMethod,
      buildVersion,
      androidVersionCode,
      androidKeystoreName: this.input.androidKeystoreName,
      androidKeystoreBase64: this.input.androidKeystoreBase64,
      androidKeystorePass: this.input.androidKeystorePass,
      androidKeyaliasName: this.input.androidKeyaliasName,
      androidKeyaliasPass: this.input.androidKeyaliasPass,
      androidTargetSdkVersion,
      androidSdkManagerParameters,
      customParameters: this.get('customParameters'),
      sshAgent: this.input.sshAgent,
      gitPrivateToken: this.get('gitPrivateToken'),
      chownFilesTo: this.input.chownFilesTo,
      customJob: this.input.customJob,
    };

    const commandParameterOverrides = await this.command.parseParameters(this.input, parameters);

    // Todo - Maybe return an instance instead
    return {
      ...parameters,
      ...commandParameterOverrides,
    };
  }

  private getUnitySerial() {
    let unitySerial = this.get('unitySerial');

    if (!unitySerial && this.env.getOS() === 'windows') {
      const unityLicense = this.get('unityLicense');

      unitySerial = this.getSerialFromLicense(unityLicense);
    }

    return unitySerial;
  }

  private getSerialFromLicense(license) {
    if (!license) {
      throw new Error(String.dedent`
          Missing Unity License File and no Unity Serial was found. If this is a personal license,
          make sure to follow the activation steps and set the UNITY_LICENSE variable or enter
          a Unity serial number inside the UNITY_SERIAL variable.
        `);
    }

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

  registerCommand(command: CommandInterface) {
    this.command = command;

    return this;
  }
}

export default Parameters;
