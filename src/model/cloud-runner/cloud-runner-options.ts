import { Cli } from '../cli/cli';
import CloudRunnerQueryOverride from './services/cloud-runner-query-override';
import GitHub from '../github';
import * as core from '@actions/core';

class CloudRunnerOptions {
  // ### ### ###
  // Input Handling
  // ### ### ###
  public static getInput(query: string): string | undefined {
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
  }

  public static ToEnvVarFormat(input: string): string {
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
    return CloudRunnerOptions.getInput('githubChecks') === 'true' || false;
  }

  static get githubOwner(): string {
    return CloudRunnerOptions.getInput('githubOwner') || CloudRunnerOptions.githubRepo?.split(`/`)[0] || '';
  }

  static get githubRepoName(): string {
    return CloudRunnerOptions.getInput('githubRepoName') || CloudRunnerOptions.githubRepo?.split(`/`)[1] || '';
  }

  // ### ### ###
  // Git syncronization parameters
  // ### ### ###

  static get githubRepo(): string | undefined {
    return CloudRunnerOptions.getInput('GITHUB_REPOSITORY') || CloudRunnerOptions.getInput('GITHUB_REPO') || undefined;
  }

  static get branch(): string {
    if (CloudRunnerOptions.getInput(`GITHUB_REF`)) {
      return CloudRunnerOptions.getInput(`GITHUB_REF`)!.replace('refs/', '').replace(`head/`, '').replace(`heads/`, '');
    } else if (CloudRunnerOptions.getInput('branch')) {
      return CloudRunnerOptions.getInput('branch')!;
    } else {
      return '';
    }
  }

  static get gitSha(): string | undefined {
    if (CloudRunnerOptions.getInput(`GITHUB_SHA`)) {
      return CloudRunnerOptions.getInput(`GITHUB_SHA`)!;
    } else if (CloudRunnerOptions.getInput(`GitSHA`)) {
      return CloudRunnerOptions.getInput(`GitSHA`)!;
    }
  }

  // ### ### ###
  // Cloud Runner parameters
  // ### ### ###

  static get cloudRunnerBuilderPlatform(): string | undefined {
    const input = CloudRunnerOptions.getInput('cloudRunnerBuilderPlatform');
    if (input) {
      return input;
    }
    if (CloudRunnerOptions.cloudRunnerCluster !== 'local') {
      return 'linux';
    }

    return;
  }

  static get cloudRunnerBranch(): string {
    return CloudRunnerOptions.getInput('cloudRunnerBranch') || 'main';
  }

  static get cloudRunnerCluster(): string {
    if (Cli.isCliMode) {
      return CloudRunnerOptions.getInput('cloudRunnerCluster') || 'aws';
    }

    return CloudRunnerOptions.getInput('cloudRunnerCluster') || 'local';
  }

  static get cloudRunnerCpu(): string | undefined {
    return CloudRunnerOptions.getInput('cloudRunnerCpu');
  }

  static get cloudRunnerMemory(): string | undefined {
    return CloudRunnerOptions.getInput('cloudRunnerMemory');
  }

  static get customJob(): string {
    return CloudRunnerOptions.getInput('customJob') || '';
  }

  // ### ### ###
  // Custom commands from files parameters
  // ### ### ###

  static get customStepFiles(): string[] {
    return CloudRunnerOptions.getInput('customStepFiles')?.split(`,`) || [];
  }

  static get customHookFiles(): string[] {
    return CloudRunnerOptions.getInput('customHookFiles')?.split(`,`) || [];
  }

  // ### ### ###
  // Custom commands from yaml parameters
  // ### ### ###

  static customJobHooks(): string {
    return CloudRunnerOptions.getInput('customJobHooks') || '';
  }

  static get postBuildSteps(): string {
    return CloudRunnerOptions.getInput('postBuildSteps') || '';
  }

  static get preBuildSteps(): string {
    return CloudRunnerOptions.getInput('preBuildSteps') || '';
  }

  // ### ### ###
  // Input override handling
  // ### ### ###

  static readInputFromOverrideList(): string {
    return CloudRunnerOptions.getInput('readInputFromOverrideList') || '';
  }

  static readInputOverrideCommand(): string {
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

  static get awsBaseStackName(): string {
    return CloudRunnerOptions.getInput('awsBaseStackName') || 'game-ci';
  }

  // ### ### ###
  // K8s
  // ### ### ###

  static get kubeConfig(): string {
    return CloudRunnerOptions.getInput('kubeConfig') || '';
  }

  static get kubeVolume(): string {
    return CloudRunnerOptions.getInput('kubeVolume') || '';
  }

  static get kubeVolumeSize(): string {
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
    return (
      CloudRunnerOptions.getInput(`cloudRunnerTests`) === 'true' ||
      CloudRunnerOptions.getInput(`cloudRunnerDebug`) === 'true' ||
      false
    );
  }
  static get cloudRunnerDebugTree(): string | boolean {
    return CloudRunnerOptions.getInput(`cloudRunnerDebugTree`) || false;
  }
  static get cloudRunnerDebugEnv(): string | boolean {
    return CloudRunnerOptions.getInput(`cloudRunnerDebugEnv`) || false;
  }

  static get watchCloudRunnerToEnd(): boolean {
    if (CloudRunnerOptions.asyncCloudRunner) {
      return false;
    }

    return CloudRunnerOptions.getInput(`watchToEnd`) === 'true' || true;
  }

  static get asyncCloudRunner(): boolean {
    return (CloudRunnerOptions.getInput('asyncCloudRunner') || `false`) === `true` || false;
  }

  public static get useSharedLargePackages(): boolean {
    return (CloudRunnerOptions.getInput(`useSharedLargePackages`) || 'false') === 'true';
  }

  public static get useSharedBuilder(): boolean {
    return (CloudRunnerOptions.getInput(`useSharedBuilder`) || 'true') === 'true';
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
    return CloudRunnerOptions.getInput(`retainWorkspaces`) === 'true' || false;
  }

  static get maxRetainedWorkspaces(): number {
    return Number(CloudRunnerOptions.getInput(`maxRetainedWorkspaces`)) || 3;
  }

  // ### ### ###
  // Garbage Collection
  // ### ### ###

  static get constantGarbageCollection(): boolean {
    return CloudRunnerOptions.getInput(`constantGarbageCollection`) === 'true' || true;
  }

  static get garbageCollectionMaxAge(): number {
    return Number(CloudRunnerOptions.getInput(`garbageCollectionMaxAge`)) || 24;
  }
}

export default CloudRunnerOptions;
