import { Cli } from '../../cli/cli';
import OrchestratorQueryOverride from './orchestrator-query-override';
import GitHub from '../../github';
import * as core from '@actions/core';

class OrchestratorOptions {
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
    const alternativeQuery = OrchestratorOptions.ToEnvVarFormat(query);

    // Query input sources
    if (Cli.query(query, alternativeQuery)) {
      return Cli.query(query, alternativeQuery);
    }

    if (OrchestratorQueryOverride.query(query, alternativeQuery)) {
      return OrchestratorQueryOverride.query(query, alternativeQuery);
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
    return OrchestratorOptions.getInput('region') || 'eu-west-2';
  }

  // ### ### ###
  // GitHub  parameters
  // ### ### ###
  static get githubChecks(): boolean {
    const value = OrchestratorOptions.getInput('githubChecks');

    return value === `true` || false;
  }
  static get githubCheckId(): string {
    return OrchestratorOptions.getInput('githubCheckId') || ``;
  }

  static get githubOwner(): string {
    return OrchestratorOptions.getInput('githubOwner') || OrchestratorOptions.githubRepo?.split(`/`)[0] || '';
  }

  static get githubRepoName(): string {
    return OrchestratorOptions.getInput('githubRepoName') || OrchestratorOptions.githubRepo?.split(`/`)[1] || '';
  }

  static get orchestratorRepoName(): string {
    return OrchestratorOptions.getInput('orchestratorRepoName') || 'game-ci/unity-builder';
  }

  static get cloneDepth(): string {
    return OrchestratorOptions.getInput('cloneDepth') || '50';
  }

  static get finalHooks(): string[] {
    return OrchestratorOptions.getInput('finalHooks')?.split(',') || [];
  }

  // ### ### ###
  // Git syncronization parameters
  // ### ### ###

  static get githubRepo(): string | undefined {
    return (
      OrchestratorOptions.getInput('GITHUB_REPOSITORY') || OrchestratorOptions.getInput('GITHUB_REPO') || undefined
    );
  }
  static get branch(): string {
    if (OrchestratorOptions.getInput(`GITHUB_REF`)) {
      return (
        OrchestratorOptions.getInput(`GITHUB_REF`)?.replace('refs/', '').replace(`head/`, '').replace(`heads/`, '') ||
        ``
      );
    } else if (OrchestratorOptions.getInput('branch')) {
      return OrchestratorOptions.getInput('branch') || ``;
    } else {
      return '';
    }
  }

  // ### ### ###
  // Orchestrator parameters
  // ### ### ###

  static get buildPlatform(): string {
    const input = OrchestratorOptions.getInput('buildPlatform');
    if (input && input !== '') {
      return input;
    }
    if (OrchestratorOptions.providerStrategy !== 'local') {
      return 'linux';
    }

    return process.platform;
  }

  static get orchestratorBranch(): string {
    return OrchestratorOptions.getInput('orchestratorBranch') || 'main';
  }

  static get providerStrategy(): string {
    const provider =
      OrchestratorOptions.getInput('orchestratorCluster') || OrchestratorOptions.getInput('providerStrategy');
    if (Cli.isCliMode) {
      return provider || 'aws';
    }

    return provider || 'local';
  }

  static get fallbackProviderStrategy(): string {
    return OrchestratorOptions.getInput('fallbackProviderStrategy') || '';
  }

  static get runnerCheckEnabled(): boolean {
    return OrchestratorOptions.getInput('runnerCheckEnabled') === 'true';
  }

  static get runnerCheckLabels(): string[] {
    const labels = OrchestratorOptions.getInput('runnerCheckLabels');

    return labels ? labels.split(',').map((l) => l.trim()) : [];
  }

  static get runnerCheckMinAvailable(): number {
    return Number(OrchestratorOptions.getInput('runnerCheckMinAvailable')) || 1;
  }

  static get retryOnFallback(): boolean {
    return OrchestratorOptions.getInput('retryOnFallback') === 'true';
  }

  static get providerInitTimeout(): number {
    return Number(OrchestratorOptions.getInput('providerInitTimeout')) || 0;
  }

  static get gitAuthMode(): string {
    return OrchestratorOptions.getInput('gitAuthMode') || 'header';
  }

  static get containerCpu(): string {
    return OrchestratorOptions.getInput('containerCpu') || `1024`;
  }

  static get containerMemory(): string {
    return OrchestratorOptions.getInput('containerMemory') || `3072`;
  }

  static get containerNamespace(): string {
    return OrchestratorOptions.getInput('containerNamespace') || `default`;
  }

  static get customJob(): string {
    return OrchestratorOptions.getInput('customJob') || '';
  }

  // ### ### ###
  // Custom commands from files parameters
  // ### ### ###

  static get containerHookFiles(): string[] {
    return OrchestratorOptions.getInput('containerHookFiles')?.split(`,`) || [];
  }

  static get commandHookFiles(): string[] {
    return OrchestratorOptions.getInput('commandHookFiles')?.split(`,`) || [];
  }

  // ### ### ###
  // Custom commands from yaml parameters
  // ### ### ###

  static get commandHooks(): string {
    return OrchestratorOptions.getInput('commandHooks') || '';
  }

  static get postBuildContainerHooks(): string {
    return OrchestratorOptions.getInput('postBuildContainerHooks') || '';
  }

  static get preBuildContainerHooks(): string {
    return OrchestratorOptions.getInput('preBuildContainerHooks') || '';
  }

  // ### ### ###
  // Input override handling
  // ### ### ###

  static get pullInputList(): string[] {
    return OrchestratorOptions.getInput('pullInputList')?.split(`,`) || [];
  }

  static get secretSource(): string {
    return OrchestratorOptions.getInput('secretSource') || '';
  }

  static get inputPullCommand(): string {
    const value = OrchestratorOptions.getInput('inputPullCommand');

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
    return OrchestratorOptions.getInput('awsStackName') || 'game-ci';
  }

  static get awsEndpoint(): string | undefined {
    return OrchestratorOptions.getInput('awsEndpoint');
  }

  static get awsCloudFormationEndpoint(): string | undefined {
    return OrchestratorOptions.getInput('awsCloudFormationEndpoint') || OrchestratorOptions.awsEndpoint;
  }

  static get awsEcsEndpoint(): string | undefined {
    return OrchestratorOptions.getInput('awsEcsEndpoint') || OrchestratorOptions.awsEndpoint;
  }

  static get awsKinesisEndpoint(): string | undefined {
    return OrchestratorOptions.getInput('awsKinesisEndpoint') || OrchestratorOptions.awsEndpoint;
  }

  static get awsCloudWatchLogsEndpoint(): string | undefined {
    return OrchestratorOptions.getInput('awsCloudWatchLogsEndpoint') || OrchestratorOptions.awsEndpoint;
  }

  static get awsS3Endpoint(): string | undefined {
    return OrchestratorOptions.getInput('awsS3Endpoint') || OrchestratorOptions.awsEndpoint;
  }

  // ### ### ###
  // Storage
  // ### ### ###

  static get storageProvider(): string {
    return OrchestratorOptions.getInput('storageProvider') || 's3';
  }

  static get rcloneRemote(): string {
    return OrchestratorOptions.getInput('rcloneRemote') || '';
  }

  // ### ### ###
  // K8s
  // ### ### ###

  static get kubeConfig(): string {
    return OrchestratorOptions.getInput('kubeConfig') || '';
  }

  static get kubeVolume(): string {
    return OrchestratorOptions.getInput('kubeVolume') || '';
  }

  static get kubeVolumeSize(): string {
    return OrchestratorOptions.getInput('kubeVolumeSize') || '25Gi';
  }

  static get kubeStorageClass(): string {
    return OrchestratorOptions.getInput('kubeStorageClass') || '';
  }

  // ### ### ###
  // Caching
  // ### ### ###

  static get cacheKey(): string {
    return OrchestratorOptions.getInput('cacheKey') || OrchestratorOptions.branch;
  }

  // ### ### ###
  // Utility Parameters
  // ### ### ###

  static get orchestratorDebug(): boolean {
    return (
      OrchestratorOptions.getInput(`orchestratorTests`) === `true` ||
      OrchestratorOptions.getInput(`orchestratorDebug`) === `true` ||
      OrchestratorOptions.getInput(`orchestratorDebugTree`) === `true` ||
      OrchestratorOptions.getInput(`orchestratorDebugEnv`) === `true` ||
      false
    );
  }
  static get skipLfs(): boolean {
    return OrchestratorOptions.getInput(`skipLfs`) === `true`;
  }
  static get skipCache(): boolean {
    return OrchestratorOptions.getInput(`skipCache`) === `true`;
  }

  public static get asyncOrchestrator(): boolean {
    return OrchestratorOptions.getInput('asyncOrchestrator') === 'true';
  }

  public static get resourceTracking(): boolean {
    return OrchestratorOptions.getInput('resourceTracking') === 'true';
  }

  public static get useLargePackages(): boolean {
    return OrchestratorOptions.getInput(`useLargePackages`) === `true`;
  }

  public static get useSharedBuilder(): boolean {
    return OrchestratorOptions.getInput(`useSharedBuilder`) === `true`;
  }

  public static get useCompressionStrategy(): boolean {
    return OrchestratorOptions.getInput(`useCompressionStrategy`) === `true`;
  }

  public static get useCleanupCron(): boolean {
    return (OrchestratorOptions.getInput(`useCleanupCron`) || 'true') === 'true';
  }

  // ### ### ###
  // Retained Workspace
  // ### ### ###

  public static get maxRetainedWorkspaces(): string {
    return OrchestratorOptions.getInput(`maxRetainedWorkspaces`) || `0`;
  }

  // ### ### ###
  // Garbage Collection
  // ### ### ###

  static get garbageMaxAge(): number {
    return Number(OrchestratorOptions.getInput(`garbageMaxAge`)) || 24;
  }
}

export default OrchestratorOptions;
