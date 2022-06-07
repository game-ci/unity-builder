import fs from '../../../node_modules/fs';
import * as path from 'https://deno.land/std@0.141.0/path/mod.ts';
import { Cli } from './cli/cli.ts';
import CloudRunnerQueryOverride from './cloud-runner/services/cloud-runner-query-override.ts';
import Platform from './platform.ts';

const core = require('@actions/core');

/**
 * Input variables specified in workflows using "with" prop.
 *
 * Note that input is always passed as a string, even booleans.
 *
 * Todo: rename to UserInput and remove anything that is not direct input from the user / ci workflow
 */
class Input {
  public static githubInputEnabled: boolean = true;

  public static getInput(query) {
    if (Input.githubInputEnabled) {
      const coreInput = core.getInput(query);
      if (coreInput && coreInput !== '') {
        return coreInput;
      }
    }
    const alternativeQuery = Input.ToEnvVarFormat(query);

    // Query input sources
    if (Cli.query(query, alternativeQuery)) {
      return Cli.query(query, alternativeQuery);
    }

    if (CloudRunnerQueryOverride.query(query, alternativeQuery)) {
      return CloudRunnerQueryOverride.query(query, alternativeQuery);
    }

    if (process.env[query] !== undefined) {
      return process.env[query];
    }

    if (alternativeQuery !== query && process.env[alternativeQuery] !== undefined) {
      return process.env[alternativeQuery];
    }

    return;
  }

  static get region(): string {
    return Input.getInput('region') || 'eu-west-2';
  }

  static get githubRepo() {
    return Input.getInput('GITHUB_REPOSITORY') || Input.getInput('GITHUB_REPO') || undefined;
  }
  static get branch() {
    if (Input.getInput(`GITHUB_REF`)) {
      return Input.getInput(`GITHUB_REF`).replace('refs/', '').replace(`head/`, '').replace(`heads/`, '');
    } else if (Input.getInput('branch')) {
      return Input.getInput('branch');
    } else {
      return '';
    }
  }
  static get cloudRunnerBuilderPlatform() {
    const input = Input.getInput('cloudRunnerBuilderPlatform');
    if (input) {
      return input;
    }
    if (Input.cloudRunnerCluster !== 'local') {
      return 'linux';
    }

    return;
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
    return Input.getInput('customImage') || '';
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
    return Input.getInput('buildMethod') || ''; // Processed in docker file
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
    return Input.getInput('androidTargetSdkVersion') || '';
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
    if (Cli.isCliMode) {
      return Input.getInput('cloudRunnerCluster') || 'aws';
    }

    return Input.getInput('cloudRunnerCluster') || 'local';
  }

  static get cloudRunnerCpu() {
    return Input.getInput('cloudRunnerCpu');
  }

  static get cloudRunnerMemory() {
    return Input.getInput('cloudRunnerMemory');
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
    return Input.getInput('cacheKey') || Input.branch;
  }

  static get cloudRunnerTests(): boolean {
    return Input.getInput(`cloudRunnerTests`) || false;
  }

  public static ToEnvVarFormat(input: string) {
    if (input.toUpperCase() === input) {
      return input;
    }

    return input
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .toUpperCase()
      .replace(/ /g, '_');
  }
}

export default Input;
