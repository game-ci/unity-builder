import { Cli } from '../cli/cli';
import CloudRunnerQueryOverride from './services/cloud-runner-query-override';
import GitHub from '../github';
const core = require('@actions/core');

class CloudRunnerOptions {
  // ### ### ###
  // Input Handling
  // ### ### ###
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

  // ### ### ###
  // Provider parameters
  // ### ### ###

  static get region(): string {
    return CloudRunnerOptions.getInput('region') || 'eu-west-2';
  }

  // ### ### ###
  // GitHub  parameters
  // ### ### ###
  static get githubChecks(): boolean {
    return CloudRunnerOptions.getInput('githubChecks') || false;
  }
  static get githubCheckId(): string {
    return CloudRunnerOptions.getInput('githubCheckId') || ``;
  }

  static get githubOwner() {
    return CloudRunnerOptions.getInput('githubOwner') || CloudRunnerOptions.githubRepo.split(`/`)[0] || false;
  }

  static get githubRepoName() {
    return CloudRunnerOptions.getInput('githubRepoName') || CloudRunnerOptions.githubRepo.split(`/`)[1] || false;
  }

  // ### ### ###
  // Git syncronization parameters
  // ### ### ###

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

  static get gitSha() {
    if (CloudRunnerOptions.getInput(`GITHUB_SHA`)) {
      return CloudRunnerOptions.getInput(`GITHUB_SHA`);
    } else if (CloudRunnerOptions.getInput(`GitSHA`)) {
      return CloudRunnerOptions.getInput(`GitSHA`);
    }
  }

  // ### ### ###
  // Cloud Runner parameters
  // ### ### ###

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

  static get cloudRunnerBranch() {
    return CloudRunnerOptions.getInput('cloudRunnerBranch') || 'main';
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

  static get customJob() {
    return CloudRunnerOptions.getInput('customJob') || '';
  }

  // ### ### ###
  // Custom commands from files parameters
  // ### ### ###

  static get customStepFiles() {
    return CloudRunnerOptions.getInput('customStepFiles')?.split(`,`) || [];
  }

  static get customHookFiles() {
    return CloudRunnerOptions.getInput('customHookFiles')?.split(`,`) || [];
  }

  // ### ### ###
  // Custom commands from yaml parameters
  // ### ### ###

  static customJobHooks() {
    return CloudRunnerOptions.getInput('customJobHooks') || '';
  }

  static get postBuildSteps() {
    return CloudRunnerOptions.getInput('postBuildSteps') || '';
  }

  static get preBuildSteps() {
    return CloudRunnerOptions.getInput('preBuildSteps') || '';
  }

  // ### ### ###
  // Input override handling
  // ### ### ###

  static readInputFromOverrideList() {
    return CloudRunnerOptions.getInput('readInputFromOverrideList') || '';
  }

  static readInputOverrideCommand() {
    const value = CloudRunnerOptions.getInput('readInputOverrideCommand');

    if (value === 'gcp-secret-manager') {
      return 'gcloud secrets versions access 1 --secret="{0}"';
    } else if (value === 'aws-secret-manager') {
      return 'aws secretsmanager get-secret-value --secret-id {0}';
    }

    return value || '';
  }

  // ### ### ###
  // Aws
  // ### ### ###

  static get awsBaseStackName() {
    return CloudRunnerOptions.getInput('awsBaseStackName') || 'game-ci';
  }

  // ### ### ###
  // K8s
  // ### ### ###

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

  // ### ### ###
  // Caching
  // ### ### ###

  static get cacheKey(): string {
    return CloudRunnerOptions.getInput('cacheKey') || CloudRunnerOptions.branch;
  }

  // ### ### ###
  // Utility Parameters
  // ### ### ###

  static get cloudRunnerDebug(): boolean {
    return CloudRunnerOptions.getInput(`cloudRunnerTests`) || CloudRunnerOptions.getInput(`cloudRunnerDebug`) || false;
  }
  static get cloudRunnerDebugTree(): boolean {
    return CloudRunnerOptions.getInput(`cloudRunnerDebugTree`) || false;
  }
  static get cloudRunnerDebugEnv(): boolean {
    return CloudRunnerOptions.getInput(`cloudRunnerDebugEnv`) || false;
  }

  static get watchCloudRunnerToEnd(): boolean {
    if (CloudRunnerOptions.asyncCloudRunner) {
      return false;
    }

    return CloudRunnerOptions.getInput(`watchToEnd`) || true;
  }

  public static get asyncCloudRunner(): boolean {
    return (CloudRunnerOptions.getInput('asyncCloudRunner') || `false`) === `true` || false;
  }

  public static get useSharedLargePackages(): boolean {
    return (CloudRunnerOptions.getInput(`useSharedLargePackages`) || 'false') === 'true';
  }

  public static get useSharedBuilder(): boolean {
    return (CloudRunnerOptions.getInput(`useSharedBuilder`) || 'false') === 'true';
  }

  public static get useLz4Compression(): boolean {
    return (CloudRunnerOptions.getInput(`useLz4Compression`) || 'false') === 'true';
  }

  public static get useCleanupCron(): boolean {
    return (CloudRunnerOptions.getInput(`useCleanupCron`) || 'true') === 'true';
  }

  // ### ### ###
  // Retained Workspace
  // ### ### ###

  public static get retainWorkspaces(): boolean {
    return CloudRunnerOptions.getInput(`retainWorkspaces`) || false;
  }

  static get maxRetainedWorkspaces(): number {
    return Number(CloudRunnerOptions.getInput(`maxRetainedWorkspaces`)) || 3;
  }

  // ### ### ###
  // Garbage Collection
  // ### ### ###

  static get constantGarbageCollection(): boolean {
    return CloudRunnerOptions.getInput(`constantGarbageCollection`) || true;
  }

  static get garbageCollectionMaxAge(): number {
    return Number(CloudRunnerOptions.getInput(`garbageCollectionMaxAge`)) || 24;
  }
}

export default CloudRunnerOptions;
