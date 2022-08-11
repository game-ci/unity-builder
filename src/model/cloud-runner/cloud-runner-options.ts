import { Cli } from '../cli/cli';
import CloudRunnerQueryOverride from './services/cloud-runner-query-override';
import GitHub from '../github';
const core = require('@actions/core');

class CloudRunnerOptions {
  public static getInput(query) {
    if (GitHub.githubInputEnabled) {
      const coreInput = core.getInput(query);
      if (coreInput && coreInput !== '') {
        return coreInput;
      }
    }
    const alternativeQuery = CloudRunnerOptions.ToEnvVarFormat(query);

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
    return CloudRunnerOptions.getInput('region') || 'eu-west-2';
  }

  static get githubRepo() {
    return CloudRunnerOptions.getInput('GITHUB_REPOSITORY') || CloudRunnerOptions.getInput('GITHUB_REPO') || undefined;
  }
  static get branch() {
    if (CloudRunnerOptions.getInput(`GITHUB_REF`)) {
      return CloudRunnerOptions.getInput(`GITHUB_REF`).replace('refs/', '').replace(`head/`, '').replace(`heads/`, '');
    } else if (CloudRunnerOptions.getInput('branch')) {
      return CloudRunnerOptions.getInput('branch');
    } else {
      return '';
    }
  }
  static get cloudRunnerBuilderPlatform() {
    const input = CloudRunnerOptions.getInput('cloudRunnerBuilderPlatform');
    if (input) {
      return input;
    }
    if (CloudRunnerOptions.cloudRunnerCluster !== 'local') {
      return 'linux';
    }

    return;
  }

  static get gitSha() {
    if (CloudRunnerOptions.getInput(`GITHUB_SHA`)) {
      return CloudRunnerOptions.getInput(`GITHUB_SHA`);
    } else if (CloudRunnerOptions.getInput(`GitSHA`)) {
      return CloudRunnerOptions.getInput(`GitSHA`);
    }
  }

  static get customJob() {
    return CloudRunnerOptions.getInput('customJob') || '';
  }

  static customJobHooks() {
    return CloudRunnerOptions.getInput('customJobHooks') || '';
  }

  static cachePushOverrideCommand() {
    return CloudRunnerOptions.getInput('cachePushOverrideCommand') || '';
  }

  static cachePullOverrideCommand() {
    return CloudRunnerOptions.getInput('cachePullOverrideCommand') || '';
  }

  static readInputFromOverrideList() {
    return CloudRunnerOptions.getInput('readInputFromOverrideList') || '';
  }

  static readInputOverrideCommand() {
    return CloudRunnerOptions.getInput('readInputOverrideCommand') || '';
  }

  static get cloudRunnerBranch() {
    return CloudRunnerOptions.getInput('cloudRunnerBranch') || 'cloud-runner-develop';
  }

  static get postBuildSteps() {
    return CloudRunnerOptions.getInput('postBuildSteps') || '';
  }

  static get preBuildSteps() {
    return CloudRunnerOptions.getInput('preBuildSteps') || '';
  }

  static get awsBaseStackName() {
    return CloudRunnerOptions.getInput('awsBaseStackName') || 'game-ci';
  }

  static get cloudRunnerCluster() {
    if (Cli.isCliMode) {
      return CloudRunnerOptions.getInput('cloudRunnerCluster') || 'aws';
    }

    return CloudRunnerOptions.getInput('cloudRunnerCluster') || 'local';
  }

  static get cloudRunnerCpu() {
    return CloudRunnerOptions.getInput('cloudRunnerCpu');
  }

  static get cloudRunnerMemory() {
    return CloudRunnerOptions.getInput('cloudRunnerMemory');
  }

  static get kubeConfig() {
    return CloudRunnerOptions.getInput('kubeConfig') || '';
  }

  static get kubeVolume() {
    return CloudRunnerOptions.getInput('kubeVolume') || '';
  }

  static get kubeVolumeSize() {
    return CloudRunnerOptions.getInput('kubeVolumeSize') || '5Gi';
  }

  static get kubeStorageClass(): string {
    return CloudRunnerOptions.getInput('kubeStorageClass') || '';
  }

  static get checkDependencyHealthOverride(): string {
    return CloudRunnerOptions.getInput('checkDependencyHealthOverride') || '';
  }

  static get startDependenciesOverride(): string {
    return CloudRunnerOptions.getInput('startDependenciesOverride') || '';
  }

  static get cacheKey(): string {
    return CloudRunnerOptions.getInput('cacheKey') || CloudRunnerOptions.branch;
  }

  static get cloudRunnerTests(): boolean {
    return CloudRunnerOptions.getInput(`cloudRunnerTests`) || false;
  }

  static get watchCloudRunnerToEnd(): boolean {
    const input = CloudRunnerOptions.getInput(`watchToEnd`);

    return !input || input === 'true';
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

export default CloudRunnerOptions;
