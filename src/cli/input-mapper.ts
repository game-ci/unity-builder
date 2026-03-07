import { Cli } from '../model/cli/cli';
import GitHub from '../model/github';

/**
 * Maps CLI arguments (kebab-case flags) to the Input/OrchestratorOptions
 * interface used by the action. This bridges the gap between user-friendly
 * CLI flags and the camelCase environment/input system unity-builder expects.
 *
 * The existing Input class already queries Cli.options, environment variables,
 * and GitHub Action inputs in priority order. We populate Cli.options so that
 * the rest of the codebase works unchanged.
 */
export interface CliArguments {
  targetPlatform?: string;
  unityVersion?: string;
  projectPath?: string;
  buildProfile?: string;
  buildName?: string;
  buildsPath?: string;
  buildMethod?: string;
  customParameters?: string;
  versioning?: string;
  version?: string;
  customImage?: string;
  manualExit?: boolean;
  enableGpu?: boolean;

  androidVersionCode?: string;
  androidExportType?: string;
  androidKeystoreName?: string;
  androidKeystoreBase64?: string;
  androidKeystorePass?: string;
  androidKeyaliasName?: string;
  androidKeyaliasPass?: string;
  androidTargetSdkVersion?: string;
  androidSymbolType?: string;

  dockerCpuLimit?: string;
  dockerMemoryLimit?: string;
  dockerIsolationMode?: string;
  dockerWorkspacePath?: string;
  containerRegistryRepository?: string;
  containerRegistryImageVersion?: string;
  runAsHostUser?: string;
  chownFilesTo?: string;

  sshAgent?: string;
  sshPublicKeysDirectoryPath?: string;
  gitPrivateToken?: string;

  providerStrategy?: string;
  awsStackName?: string;
  kubeConfig?: string;
  kubeVolume?: string;
  kubeVolumeSize?: string;
  kubeStorageClass?: string;
  containerCpu?: string;
  containerMemory?: string;
  cacheKey?: string;
  watchToEnd?: string;
  allowDirtyBuild?: boolean;
  skipActivation?: string;
  cloneDepth?: string;

  readInputFromOverrideList?: string;
  readInputOverrideCommand?: string;
  postBuildSteps?: string;
  preBuildSteps?: string;
  customJob?: string;

  unityLicensingServer?: string;

  cacheUnityInstallationOnMac?: boolean;
  unityHubVersionOnMac?: string;

  testMode?: string;
  testResultsPath?: string;
  testCategory?: string;
  testFilter?: string;
  coverageOptions?: string;
  enableCodeCoverage?: boolean;

  mode?: string;

  [key: string]: unknown;
}

/**
 * Converts kebab-case CLI flags to camelCase keys matching the Input class
 * property names, then injects them into Cli.options so the existing
 * Input.getInput() / OrchestratorOptions.getInput() chain picks them up.
 */
export function mapCliArgumentsToInput(cliArguments: CliArguments): void {
  // Disable GitHub Actions input reading when in CLI mode
  GitHub.githubInputEnabled = false;

  // The existing Cli.options mechanism is used by Input.getInput() to query
  // CLI-provided values. We set it directly.
  const mapped: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(cliArguments)) {
    if (value !== undefined && key !== '_' && key !== '$0') {
      mapped[key] = typeof value === 'boolean' ? String(value) : value;
    }
  }

  // Ensure mode is set so Cli.isCliMode returns true
  if (!mapped['mode']) {
    mapped['mode'] = 'cli';
  }

  Cli.options = mapped;
}
