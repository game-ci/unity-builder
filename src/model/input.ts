import fs from 'fs';
import path from 'path';
import { GenericInputReader } from './input-readers/generic-input-reader';
import Platform from './platform';

const formatFunction = (value, arguments_) => {
  let formatted = value;
  for (const argument in arguments_) {
    formatted = formatted.replace(`{${arguments_[argument].key}}`, arguments_[argument].value);
  }
  return formatted;
};

const core = require('@actions/core');

/**
 * Input variables specified in workflows using "with" prop.
 *
 * Note that input is always passed as a string, even booleans.
 */
class Input {
  public static cliOptions;
  public static queryOverrides;
  public static githubInputEnabled: boolean = true;

  // also enabled debug logging for cloud runner
  static get cloudRunnerTests(): boolean {
    return Input.getInput(`cloudRunnerTests`) || Input.getInput(`CloudRunnerTests`) || false;
  }
  private static shouldUseOverride(query) {
    if (Input.readInputOverrideCommand() !== '') {
      if (Input.readInputFromOverrideList() !== '') {
        const doesInclude =
          Input.readInputFromOverrideList().split(',').includes(query) ||
          Input.readInputFromOverrideList().split(',').includes(Input.ToEnvVarFormat(query));
        return doesInclude ? true : false;
      } else {
        return true;
      }
    }
  }
  static get cliMode() {
    return Input.cliOptions !== undefined && Input.cliOptions.mode !== undefined && Input.cliOptions.mode !== '';
  }

  private static async queryOverride(query) {
    if (!this.shouldUseOverride(query)) {
      throw new Error(`Should not be trying to run override query on ${query}`);
    }

    return await GenericInputReader.Run(formatFunction(Input.readInputOverrideCommand(), [{ key: 0, value: query }]));
  }

  public static async PopulateQueryOverrideInput() {
    const queries = Input.readInputFromOverrideList().split(',');
    Input.queryOverrides = new Array();
    for (const element of queries) {
      if (Input.shouldUseOverride(element)) {
        Input.queryOverrides[element] = await Input.queryOverride(element);
      }
    }
  }

  public static getInput(query) {
    const coreInput = core.getInput(query);
    if (Input.githubInputEnabled && coreInput && coreInput !== '') {
      return coreInput;
    }

    if (Input.cliMode && Input.cliOptions[query] !== undefined) {
      return Input.cliOptions[query];
    }

    if (Input.queryOverrides !== undefined) {
      if (Input.queryOverrides[query] !== null) {
        return Input.queryOverrides[query];
      }

      if (Input.queryOverrides[Input.ToEnvVarFormat(query)] !== null) {
        return Input.queryOverrides[Input.ToEnvVarFormat(query)];
      }
    }

    if (process.env[query] !== undefined) {
      return process.env[query];
    }

    if (process.env[Input.ToEnvVarFormat(query)] !== undefined) {
      return process.env[Input.ToEnvVarFormat(query)];
    }

    return '';
  }
  static get region(): string {
    return Input.getInput('region') || 'eu-west-2';
  }

  static get githubRepo() {
    return Input.getInput('GITHUB_REPOSITORY') || Input.getInput('GITHUB_REPO') || false;
  }
  static get branch() {
    if (Input.getInput(`GITHUB_REF`)) {
      return Input.getInput(`GITHUB_REF`).replace('refs/', '').replace(`head/`, '');
    } else if (Input.getInput('branch')) {
      return Input.getInput('branch');
    } else {
      return '';
    }
  }
  static get cloudRunnerBuilderPlatform() {
    return Input.getInput('cloudRunnerBuilderPlatform') || false;
  }

  static get gitSha() {
    if (Input.getInput(`GITHUB_SHA`)) {
      return Input.getInput(`GITHUB_SHA`);
    } else if (Input.getInput(`GitSHA`)) {
      return Input.getInput(`GitSHA`);
    }
  }
  static get runNumber() {
    return Input.getInput('GITHUB_RUN_NUMBER') || '0';
  }

  static get targetPlatform() {
    return Input.getInput('targetPlatform') || Platform.default;
  }

  static get unityVersion() {
    return Input.getInput('unityVersion') || 'auto';
  }

  static get customImage() {
    return Input.getInput('customImage');
  }

  static get projectPath() {
    const input = Input.getInput('projectPath');
    const rawProjectPath = input
      ? input
      : fs.existsSync(path.join('test-project', 'ProjectSettings', 'ProjectVersion.txt')) &&
        !fs.existsSync(path.join('ProjectSettings', 'ProjectVersion.txt'))
      ? 'test-project'
      : '.';
    return rawProjectPath.replace(/\/$/, '');
  }

  static get buildName() {
    return Input.getInput('buildName') || this.targetPlatform;
  }

  static get buildsPath() {
    return Input.getInput('buildsPath') || 'build';
  }

  static get buildMethod() {
    return Input.getInput('buildMethod') || ''; // processed in docker file
  }

  static get customParameters() {
    return Input.getInput('customParameters') || '';
  }

  static get versioningStrategy() {
    return Input.getInput('versioning') || 'Semantic';
  }

  static get specifiedVersion() {
    return Input.getInput('version') || '';
  }

  static get androidVersionCode() {
    return Input.getInput('androidVersionCode');
  }

  static get androidAppBundle() {
    const input = Input.getInput('androidAppBundle') || false;

    return input === 'true';
  }

  static get androidKeystoreName() {
    return Input.getInput('androidKeystoreName') || '';
  }

  static get androidKeystoreBase64() {
    return Input.getInput('androidKeystoreBase64') || '';
  }

  static get androidKeystorePass() {
    return Input.getInput('androidKeystorePass') || '';
  }

  static get androidKeyaliasName() {
    return Input.getInput('androidKeyaliasName') || '';
  }

  static get androidKeyaliasPass() {
    return Input.getInput('androidKeyaliasPass') || '';
  }

  static get androidTargetSdkVersion() {
    return core.getInput('androidTargetSdkVersion') || '';
  }

  static get sshAgent() {
    return Input.getInput('sshAgent') || '';
  }

  static get gitPrivateToken() {
    return core.getInput('gitPrivateToken') || false;
  }

  static get customJob() {
    return Input.getInput('customJob') || '';
  }

  static customJobHooks() {
    return Input.getInput('customJobHooks') || '';
  }

  static cachePushOverrideCommand() {
    return Input.getInput('cachePushOverrideCommand') || '';
  }

  static cachePullOverrideCommand() {
    return Input.getInput('cachePullOverrideCommand') || '';
  }

  static readInputFromOverrideList() {
    return Input.getInput('readInputFromOverrideList') || '';
  }

  static readInputOverrideCommand() {
    return Input.getInput('readInputOverrideCommand') || '';
  }

  static get cloudRunnerBranch() {
    return Input.getInput('cloudRunnerBranch') || 'cloud-runner-develop';
  }

  static get chownFilesTo() {
    return Input.getInput('chownFilesTo') || '';
  }

  static get allowDirtyBuild() {
    const input = Input.getInput('allowDirtyBuild') || false;

    return input === 'true';
  }

  static get postBuildSteps() {
    return Input.getInput('postBuildSteps') || '';
  }

  static get preBuildSteps() {
    return Input.getInput('preBuildSteps') || '';
  }

  static get awsBaseStackName() {
    return Input.getInput('awsBaseStackName') || 'game-ci';
  }

  static get cloudRunnerCluster() {
    return Input.getInput('cloudRunnerCluster') || 'local';
  }

  static get cloudRunnerCpu() {
    return Input.getInput('cloudRunnerCpu') || '1.0';
  }

  static get cloudRunnerMemory() {
    return Input.getInput('cloudRunnerMemory') || '750M';
  }

  static get kubeConfig() {
    return Input.getInput('kubeConfig') || '';
  }

  static get kubeVolume() {
    return Input.getInput('kubeVolume') || '';
  }

  static get kubeVolumeSize() {
    return Input.getInput('kubeVolumeSize') || '5Gi';
  }

  static get kubeStorageClass(): string {
    return Input.getInput('kubeStorageClass') || '';
  }

  static get checkDependencyHealthOverride(): string {
    return Input.getInput('checkDependencyHealthOverride') || '';
  }

  static get startDependenciesOverride(): string {
    return Input.getInput('startDependenciesOverride') || '';
  }

  static get cacheKey(): string {
    return Input.getInput('cacheKey') || '';
  }

  public static ToEnvVarFormat(input: string) {
    return input
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .toUpperCase()
      .replace(/ /g, '_');
  }
}

export default Input;
