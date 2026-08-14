/**
 * Translates unity-builder's action inputs into `game-ci build` CLI flags.
 *
 * Two deliberate omissions, both because there is nothing to translate to:
 *  - `unityVersion` (except "auto"): the CLI always detects the Unity
 *    version from the checked-out project's ProjectSettings/ProjectVersion.txt
 *    and has no flag to override that today (game-ci/cli's engine-detection
 *    middleware unconditionally overwrites any passed value). Pinning a
 *    version other than "auto" is a known, real gap versus the original
 *    action - see the PR this shipped in.
 *  - `providerStrategy` values other than "local": the base action (without
 *    the separately-installed @game-ci/orchestrator plugin) already throws
 *    for these today, so throwing here isn't a regression.
 *
 * Boolean inputs use GitHub Actions' own truthy/falsy string convention
 * ('true'/'false', case-insensitive) - see actions/toolkit's getBooleanInput.
 */

const STRING_FLAGS: Array<[input: string, flag: string]> = [
  ['customImage', 'customImage'],
  ['buildProfile', 'buildProfile'],
  ['buildName', 'buildName'],
  ['buildsPath', 'buildsPath'],
  ['buildMethod', 'buildMethod'],
  ['customParameters', 'customParameters'],
  ['versioning', 'versioningStrategy'],
  ['version', 'version'],
  ['androidVersionCode', 'androidVersionCode'],
  ['androidExportType', 'androidExportType'],
  ['androidKeystoreName', 'androidKeystoreName'],
  ['androidKeystoreBase64', 'androidKeystoreBase64'],
  // Mapped to the current (non-deprecated) cli option names, even though
  // their own action-input names differ.
  ['androidKeystorePass', 'androidKeystorePassword'],
  ['androidKeyaliasName', 'androidKeyAlias'],
  ['androidKeyaliasPass', 'androidKeyAliasPassword'],
  ['androidTargetSdkVersion', 'androidTargetSdkVersion'],
  ['androidSymbolType', 'androidSymbolType'],
  ['sshAgent', 'sshAgent'],
  ['sshPublicKeysDirectoryPath', 'sshPublicKeysDirectoryPath'],
  ['gitPrivateToken', 'gitPrivateToken'],
  ['chownFilesTo', 'chownFilesTo'],
  ['dockerCpuLimit', 'dockerCpuLimit'],
  ['dockerMemoryLimit', 'dockerMemoryLimit'],
  ['dockerIsolationMode', 'dockerIsolationMode'],
  ['containerRegistryRepository', 'containerRegistryRepository'],
  ['containerRegistryImageVersion', 'containerRegistryImageVersion'],
  ['unityHubVersionOnMac', 'unityHubVersionOnMac'],
  ['unityLicensingServer', 'unityLicensingServer'],
  ['dockerWorkspacePath', 'dockerWorkspacePath'],
];

const BOOLEAN_FLAGS: Array<[input: string, flag: string]> = [
  ['manualExit', 'manualExit'],
  ['enableGpu', 'enableGpu'],
  ['useHostNetwork', 'useHostNetwork'],
  ['runAsHostUser', 'runAsHostUser'],
  ['allowDirtyBuild', 'allowDirtyBuild'],
  ['cacheUnityInstallationOnMac', 'cacheUnityInstallationOnMac'],
  ['skipActivation', 'skipActivation'],
  ['linux64RemoveExecutableExtension', 'linux64RemoveExecutableExtension'],
];

function isTruthy(value: string): boolean {
  return value.trim().toLowerCase() === 'true';
}

export interface BuildArgsOptions {
  getInput(name: string): string;
}

export function buildCliArgs({ getInput }: BuildArgsOptions): string[] {
  const args: string[] = ['build'];

  const projectPath = getInput('projectPath');
  if (projectPath) args.push(projectPath);

  const targetPlatform = getInput('targetPlatform');
  if (!targetPlatform) {
    throw new Error('targetPlatform is required.');
  }
  args.push('--targetPlatform', targetPlatform);

  const providerStrategy = getInput('providerStrategy') || 'local';
  if (providerStrategy !== 'local') {
    throw new Error(
      `Provider strategy "${providerStrategy}" is not supported by this thin wrapper. ` +
        "Use providerStrategy=local, or invoke game-ci/cli's `orchestrate` command directly " +
        'for remote builds.',
    );
  }

  for (const [input, flag] of STRING_FLAGS) {
    const value = getInput(input);
    if (value) args.push(`--${flag}`, value);
  }

  for (const [input, flag] of BOOLEAN_FLAGS) {
    const value = getInput(input);
    if (value && isTruthy(value)) args.push(`--${flag}`);
  }

  return args;
}
