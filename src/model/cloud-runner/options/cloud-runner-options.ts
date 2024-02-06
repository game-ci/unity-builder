import { Cli } from '../../cli/cli';
import CloudRunnerQueryOverride from './cloud-runner-query-override';
import GitHub from '../../github';
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
    const value = CloudRunnerOptions.getInput('githubChecks');

    return value === `true` || false;
  }
  static get githubCheckId(): string {
    return CloudRunnerOptions.getInput('githubCheckId') || ``;
  }

  static get githubOwner(): string {
    return CloudRunnerOptions.getInput('githubOwner') || CloudRunnerOptions.githubRepo?.split(`/`)[0] || '';
  }

  static get githubRepoName(): string {
    return CloudRunnerOptions.getInput('githubRepoName') || CloudRunnerOptions.githubRepo?.split(`/`)[1] || '';
  }

  static get finalHooks(): string[] {
    return CloudRunnerOptions.getInput('finalHooks')?.split(',') || [];
  }

  // ### ### ###
  // Git syncronization parameters
  // ### ### ###

  static get githubRepo(): string | undefined {
    return CloudRunnerOptions.getInput('GITHUB_REPOSITORY') || CloudRunnerOptions.getInput('GITHUB_REPO') || undefined;
  }
  static get branch(): string {
    if (CloudRunnerOptions.getInput(`GITHUB_REF`)) {
      return (
        CloudRunnerOptions.getInput(`GITHUB_REF`)?.replace('refs/', '').replace(`head/`, '').replace(`heads/`, '') || ``
      );
    } else if (CloudRunnerOptions.getInput('branch')) {
      return CloudRunnerOptions.getInput('branch') || ``;
    } else {
      return '';
    }
  }

  // ### ### ###
  // Cloud Runner parameters
  // ### ### ###

  static get buildPlatform(): string {
    const input = CloudRunnerOptions.getInput('buildPlatform');
    if (input && input !== '') {
      return input;
    }
    if (CloudRunnerOptions.providerStrategy !== 'local') {
      return 'linux';
    }

    return process.platform;
  }

  static get cloudRunnerBranch(): string {
    return CloudRunnerOptions.getInput('cloudRunnerBranch') || 'main';
  }

  static get providerStrategy(): string {
    const provider =
      CloudRunnerOptions.getInput('cloudRunnerCluster') || CloudRunnerOptions.getInput('providerStrategy');
    if (Cli.isCliMode) {
      return provider || 'aws';
    }

    return provider || 'local';
  }

  static get containerCpu(): string {
    return CloudRunnerOptions.getInput('containerCpu') || `1024`;
  }

  static get containerMemory(): string {
    return CloudRunnerOptions.getInput('containerMemory') || `3072`;
  }

  static get customJob(): string {
    return CloudRunnerOptions.getInput('customJob') || '';
  }

  // ### ### ###
  // Custom commands from files parameters
  // ### ### ###

  static get containerHookFiles(): string[] {
    return CloudRunnerOptions.getInput('containerHookFiles')?.split(`,`) || [];
  }

  static get commandHookFiles(): string[] {
    return CloudRunnerOptions.getInput('commandHookFiles')?.split(`,`) || [];
  }

  // ### ### ###
  // Custom commands from yaml parameters
  // ### ### ###

  static get commandHooks(): string {
    return CloudRunnerOptions.getInput('commandHooks') || '';
  }

  static get postBuildContainerHooks(): string {
    return CloudRunnerOptions.getInput('postBuildContainerHooks') || '';
  }

  static get preBuildContainerHooks(): string {
    return CloudRunnerOptions.getInput('preBuildContainerHooks') || '';
  }

  // ### ### ###
  // Input override handling
  // ### ### ###

  static get pullInputList(): string[] {
    return CloudRunnerOptions.getInput('pullInputList')?.split(`,`) || [];
  }

  static get inputPullCommand(): string {
    const value = CloudRunnerOptions.getInput('inputPullCommand');

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

  static get awsStackName() {
    return CloudRunnerOptions.getInput('awsStackName') || 'game-ci';
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
    return CloudRunnerOptions.getInput('kubeVolumeSize') || '25Gi';
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
      CloudRunnerOptions.getInput(`cloudRunnerTests`) === `true` ||
      CloudRunnerOptions.getInput(`cloudRunnerDebug`) === `true` ||
      CloudRunnerOptions.getInput(`cloudRunnerDebugTree`) === `true` ||
      CloudRunnerOptions.getInput(`cloudRunnerDebugEnv`) === `true` ||
      false
    );
  }
  static get skipLfs(): boolean {
    return CloudRunnerOptions.getInput(`skipLfs`) === `true`;
  }
  static get skipCache(): boolean {
    return CloudRunnerOptions.getInput(`skipCache`) === `true`;
  }

  public static get asyncCloudRunner(): boolean {
    return CloudRunnerOptions.getInput('asyncCloudRunner') === 'true';
  }

  public static get useLargePackages(): boolean {
    return CloudRunnerOptions.getInput(`useLargePackages`) === `true`;
  }

  public static get useSharedBuilder(): boolean {
    return CloudRunnerOptions.getInput(`useSharedBuilder`) === `true`;
  }

  public static get useCompressionStrategy(): boolean {
    return CloudRunnerOptions.getInput(`useCompressionStrategy`) === `true`;
  }

  public static get useCleanupCron(): boolean {
    return (CloudRunnerOptions.getInput(`useCleanupCron`) || 'true') === 'true';
  }

  // ### ### ###
  // Retained Workspace
  // ### ### ###

  public static get maxRetainedWorkspaces(): string {
    return CloudRunnerOptions.getInput(`maxRetainedWorkspaces`) || `0`;
  }

  // ### ### ###
  // Garbage Collection
  // ### ### ###

  static get garbageMaxAge(): number {
    return Number(CloudRunnerOptions.getInput(`garbageMaxAge`)) || 24;
  }
}

export default CloudRunnerOptions;
