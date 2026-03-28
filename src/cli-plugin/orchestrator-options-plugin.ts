/**
 * Registers all orchestrator-specific options with the CLI's yargs instance.
 *
 * These options are provider-specific (aws, k8s, storage, hooks, etc.) and
 * were previously hardcoded in the CLI's RemoteOptions. Now they live here
 * in the orchestrator plugin where they belong.
 */
export function configureOrchestratorOptions(yargs: any): void {
  // --- Provider parameters ---
  yargs.option('region', {
    description: 'Cloud provider region',
    type: 'string',
    default: 'eu-west-2',
  });

  yargs.option('buildPlatform', {
    description: 'Build platform (linux, win32, darwin)',
    type: 'string',
  });

  // --- Container resources ---
  yargs.option('containerCpu', {
    description: 'Container CPU units (1024 = 1 vCPU)',
    type: 'string',
    default: '1024',
  });

  yargs.option('containerMemory', {
    description: 'Container memory in MB',
    type: 'string',
    default: '3072',
  });

  yargs.option('containerNamespace', {
    description: 'Container/Kubernetes namespace',
    type: 'string',
    default: 'default',
  });

  // --- AWS options ---
  yargs.option('awsStackName', {
    description: 'AWS CloudFormation stack name',
    type: 'string',
    default: 'game-ci',
  });

  yargs.option('awsEndpoint', {
    description: 'AWS endpoint override (e.g., for LocalStack)',
    type: 'string',
  });

  yargs.option('awsCloudFormationEndpoint', {
    description: 'AWS CloudFormation endpoint override',
    type: 'string',
  });

  yargs.option('awsEcsEndpoint', {
    description: 'AWS ECS endpoint override',
    type: 'string',
  });

  yargs.option('awsKinesisEndpoint', {
    description: 'AWS Kinesis endpoint override',
    type: 'string',
  });

  yargs.option('awsCloudWatchLogsEndpoint', {
    description: 'AWS CloudWatch Logs endpoint override',
    type: 'string',
  });

  yargs.option('awsS3Endpoint', {
    description: 'AWS S3 endpoint override',
    type: 'string',
  });

  // --- Kubernetes options ---
  yargs.option('kubeConfig', {
    description: 'Kubernetes config (base64 encoded or path)',
    type: 'string',
    default: '',
  });

  yargs.option('kubeVolume', {
    description: 'Kubernetes persistent volume name',
    type: 'string',
    default: '',
  });

  yargs.option('kubeVolumeSize', {
    description: 'Kubernetes persistent volume size',
    type: 'string',
    default: '25Gi',
  });

  yargs.option('kubeStorageClass', {
    description: 'Kubernetes storage class',
    type: 'string',
    default: '',
  });

  // --- Storage ---
  yargs.option('storageProvider', {
    description: 'Remote storage provider (s3, gcs, etc.)',
    type: 'string',
    default: 's3',
  });

  yargs.option('rcloneRemote', {
    description: 'Rclone remote name for storage',
    type: 'string',
    default: '',
  });

  // --- Hooks ---
  yargs.option('containerHookFiles', {
    description: 'Comma-separated container hook file paths',
    type: 'string',
    default: '',
  });

  yargs.option('commandHookFiles', {
    description: 'Comma-separated command hook file paths',
    type: 'string',
    default: '',
  });

  yargs.option('commandHooks', {
    description: 'YAML command hooks',
    type: 'string',
    default: '',
  });

  yargs.option('postBuildContainerHooks', {
    description: 'Post-build container hooks (YAML)',
    type: 'string',
    default: '',
  });

  yargs.option('preBuildContainerHooks', {
    description: 'Pre-build container hooks (YAML)',
    type: 'string',
    default: '',
  });

  yargs.option('finalHooks', {
    description: 'Comma-separated final hook workflows to trigger',
    type: 'string',
    default: '',
  });

  // --- Input override ---
  yargs.option('pullInputList', {
    description: 'Comma-separated list of inputs to pull from secret manager',
    type: 'string',
    default: '',
  });

  yargs.option('inputPullCommand', {
    description: 'Command template for pulling secrets (gcp-secret-manager, aws-secret-manager, or custom)',
    type: 'string',
    default: '',
  });

  // --- Git / orchestrator ---
  yargs.option('orchestratorBranch', {
    description: 'Orchestrator repo branch',
    type: 'string',
    default: 'main',
  });

  yargs.option('orchestratorRepoName', {
    description: 'Orchestrator GitHub repo',
    type: 'string',
    default: 'game-ci/unity-builder',
  });

  yargs.option('cloneDepth', {
    description: 'Git clone depth',
    type: 'string',
    default: '50',
  });

  // --- Caching ---
  yargs.option('cacheKey', {
    description: 'Cache key for build caching',
    type: 'string',
  });

  yargs.option('skipLfs', {
    description: 'Skip Git LFS',
    type: 'boolean',
    default: false,
  });

  yargs.option('skipCache', {
    description: 'Skip caching',
    type: 'boolean',
    default: false,
  });

  // --- Advanced ---
  yargs.option('orchestratorDebug', {
    description: 'Enable orchestrator debug logging',
    type: 'boolean',
    default: false,
  });

  yargs.option('asyncOrchestrator', {
    description: 'Enable async workflow mode',
    type: 'boolean',
    default: false,
  });

  yargs.option('resourceTracking', {
    description: 'Enable resource tracking',
    type: 'boolean',
    default: false,
  });

  yargs.option('useLargePackages', {
    description: 'Use large packages mode',
    type: 'boolean',
    default: false,
  });

  yargs.option('useSharedBuilder', {
    description: 'Use shared builder',
    type: 'boolean',
    default: false,
  });

  yargs.option('useCompressionStrategy', {
    description: 'Enable compression strategy',
    type: 'boolean',
    default: false,
  });

  yargs.option('useCleanupCron', {
    description: 'Enable cleanup cron',
    type: 'boolean',
    default: true,
  });

  yargs.option('maxRetainedWorkspaces', {
    description: 'Max retained workspaces for shared builds',
    type: 'string',
    default: '0',
  });

  yargs.option('garbageMaxAge', {
    description: 'Max age in hours for garbage collection',
    type: 'number',
    default: 24,
  });

  // --- GitHub integration ---
  yargs.option('githubChecks', {
    description: 'Enable GitHub Checks integration',
    type: 'boolean',
    default: false,
  });

  yargs.option('githubCheckId', {
    description: 'Existing GitHub Check ID to update',
    type: 'string',
    default: '',
  });
}
