import BuildParameters from '../model/build-parameters';
import { customAlphabet } from 'nanoid';
import OrchestratorConstants from '../model/orchestrator/options/orchestrator-constants';

/**
 * Maps CLI yargs options (flat key-value pairs) into a BuildParameters object.
 *
 * When the orchestrator is consumed as a CLI plugin, the CLI collects options via
 * yargs and passes them as a plain object. This adapter bridges that format to the
 * BuildParameters class that all providers expect.
 */
export function createBuildParametersFromCliOptions(options: Record<string, any>): BuildParameters {
  const bp = new BuildParameters();

  // Unity / build settings
  bp.editorVersion = options.engineVersion || options.editorVersion || options.unityVersion || '';
  bp.customImage = options.customImage || '';
  bp.unitySerial = options.unitySerial || process.env.UNITY_SERIAL || '';
  bp.unityLicensingServer = options.unityLicensingServer || '';
  bp.skipActivation = options.skipActivation || 'false';
  bp.runnerTempPath = options.runnerTempPath || process.env.RUNNER_TEMP || '';
  bp.targetPlatform = options.targetPlatform || 'StandaloneLinux64';
  bp.projectPath = options.projectPath || '.';
  bp.buildProfile = options.buildProfile || '';
  bp.buildName = options.buildName || options.targetPlatform || 'StandaloneLinux64';
  bp.buildPath = options.buildPath || `build/${bp.targetPlatform}`;
  bp.buildFile = options.buildFile || bp.buildName;
  bp.buildMethod = options.buildMethod || '';
  bp.buildVersion = options.buildVersion || '0.0.1';
  bp.manualExit = options.manualExit === true || options.manualExit === 'true';
  bp.enableGpu = options.enableGpu === true || options.enableGpu === 'true';

  // Android
  bp.androidVersionCode = options.androidVersionCode || '';
  bp.androidKeystoreName = options.androidKeystoreName || '';
  bp.androidKeystoreBase64 = options.androidKeystoreBase64 || '';
  bp.androidKeystorePass = options.androidKeystorePass || '';
  bp.androidKeyaliasName = options.androidKeyaliasName || '';
  bp.androidKeyaliasPass = options.androidKeyaliasPass || '';
  bp.androidTargetSdkVersion = options.androidTargetSdkVersion || '';
  bp.androidSdkManagerParameters = options.androidSdkManagerParameters || '';
  bp.androidExportType = options.androidExportType || 'androidPackage';
  bp.androidSymbolType = options.androidSymbolType || 'none';

  // Docker / container settings
  bp.dockerCpuLimit = options.dockerCpuLimit || '';
  bp.dockerMemoryLimit = options.dockerMemoryLimit || '';
  bp.dockerIsolationMode = options.dockerIsolationMode || 'default';
  bp.containerRegistryRepository = options.containerRegistryRepository || 'unityci/editor';
  bp.containerRegistryImageVersion = options.containerRegistryImageVersion || '3';
  bp.dockerWorkspacePath = options.dockerWorkspacePath || '/github/workspace';

  // Provider / orchestrator settings
  bp.providerStrategy = options.providerStrategy || 'local-docker';
  bp.customParameters = options.customParameters || '';
  bp.sshAgent = options.sshAgent || '';
  bp.sshPublicKeysDirectoryPath = options.sshPublicKeysDirectoryPath || '';
  bp.gitPrivateToken = options.gitPrivateToken || '';
  bp.runAsHostUser = options.runAsHostUser || 'false';
  bp.chownFilesTo = options.chownFilesTo || '';

  // AWS
  bp.awsStackName = options.awsStackName || 'game-ci';
  bp.awsEndpoint = options.awsEndpoint;
  bp.awsCloudFormationEndpoint = options.awsCloudFormationEndpoint || options.awsEndpoint;
  bp.awsEcsEndpoint = options.awsEcsEndpoint || options.awsEndpoint;
  bp.awsKinesisEndpoint = options.awsKinesisEndpoint || options.awsEndpoint;
  bp.awsCloudWatchLogsEndpoint = options.awsCloudWatchLogsEndpoint || options.awsEndpoint;
  bp.awsS3Endpoint = options.awsS3Endpoint || options.awsEndpoint;

  // Storage
  bp.storageProvider = options.storageProvider || 's3';
  bp.rcloneRemote = options.rcloneRemote || '';

  // Kubernetes
  bp.kubeConfig = options.kubeConfig || '';
  bp.kubeVolume = options.kubeVolume || '';
  bp.kubeVolumeSize = options.kubeVolumeSize || '25Gi';
  bp.kubeStorageClass = options.kubeStorageClass || '';

  // Container resources
  bp.containerMemory = options.containerMemory || '3072';
  bp.containerCpu = options.containerCpu || '1024';
  bp.containerNamespace = options.containerNamespace || 'default';

  // Hooks
  bp.commandHooks = options.commandHooks || '';
  bp.postBuildContainerHooks = options.postBuildContainerHooks || '';
  bp.preBuildContainerHooks = options.preBuildContainerHooks || '';
  bp.customJob = options.customJob || '';

  // Git / CI
  bp.runNumber = options.runNumber || process.env.GITHUB_RUN_NUMBER || '0';
  bp.branch = options.branch || process.env.GITHUB_REF?.replace('refs/', '').replace('heads/', '') || '';
  bp.githubRepo = options.githubRepo || process.env.GITHUB_REPOSITORY || '';
  bp.orchestratorRepoName = options.orchestratorRepoName || 'game-ci/unity-builder';
  bp.cloneDepth = Number.parseInt(options.cloneDepth || '50', 10);
  bp.gitSha = options.gitSha || process.env.GITHUB_SHA || '';
  bp.orchestratorBranch = options.orchestratorBranch || 'main';
  bp.orchestratorDebug = options.orchestratorDebug === true || options.orchestratorDebug === 'true';

  // Build platform
  bp.buildPlatform = options.buildPlatform || (bp.providerStrategy !== 'local' ? 'linux' : process.platform);
  bp.isCliMode = true;

  // Caching
  bp.cacheKey = options.cacheKey || bp.branch;
  bp.pullInputList = options.pullInputList ? options.pullInputList.split(',') : [];
  bp.inputPullCommand = options.inputPullCommand || '';

  // Advanced
  bp.maxRetainedWorkspaces = Number.parseInt(options.maxRetainedWorkspaces || '0', 10);
  bp.useLargePackages = options.useLargePackages === true || options.useLargePackages === 'true';
  bp.useCompressionStrategy = options.useCompressionStrategy === true || options.useCompressionStrategy === 'true';
  bp.garbageMaxAge = Number(options.garbageMaxAge) || 24;
  bp.githubChecks = options.githubChecks === true || options.githubChecks === 'true';
  bp.asyncWorkflow = options.asyncOrchestrator === true || options.asyncOrchestrator === 'true';
  bp.githubCheckId = options.githubCheckId || '';
  bp.finalHooks = options.finalHooks ? options.finalHooks.split(',') : [];
  bp.skipLfs = options.skipLfs === true || options.skipLfs === 'true';
  bp.skipCache = options.skipCache === true || options.skipCache === 'true';
  bp.cacheUnityInstallationOnMac =
    options.cacheUnityInstallationOnMac === true || options.cacheUnityInstallationOnMac === 'true';
  bp.unityHubVersionOnMac = options.unityHubVersionOnMac || '';

  // IDs
  bp.logId = customAlphabet(OrchestratorConstants.alphabet, 9)();
  bp.buildGuid = options.buildGuid || `${bp.runNumber}-${bp.targetPlatform}`;

  return bp;
}
