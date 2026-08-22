/**
 * Translates unity-builder's action inputs into `game-ci build` (or, for
 * providerStrategy=local-system, `game-ci orchestrate`) CLI flags.
 *
 * Two deliberate omissions for the `build` path, both because there is
 * nothing to translate to:
 *  - `unityVersion` (except "auto"): the CLI always detects the Unity
 *    version from the checked-out project's ProjectSettings/ProjectVersion.txt
 *    and has no flag to override that today (game-ci/cli's engine-detection
 *    middleware unconditionally overwrites any passed value). Pinning a
 *    version other than "auto" is a known, real gap versus the original
 *    action - see the PR this shipped in.
 *  - `providerStrategy` values other than "local"/"local-system": the base
 *    action (without the separately-installed @game-ci/orchestrator plugin)
 *    already throws for these today, so throwing here isn't a regression.
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

/**
 * Flags carried forward into `game-ci orchestrate --providerStrategy=local-system`.
 *
 * Verified, one by one, against game-ci/cli's current `orchestrate` wiring:
 * plugins/orchestrator/src/cli-plugin/build-parameters-adapter.ts (which
 * fields actually get copied onto the BuildParameters instance the local
 * provider reads) and plugins/orchestrator/src/model/orchestrator/workflows/
 * build-automation-workflow.ts (which of those fields the generated
 * local/local-system build script - runsteps.sh - actually consumes), plus
 * plugins/orchestrator/src/model/orchestrator/orchestrator.ts and
 * .../options/orchestrator-folders.ts for the git-auth fields.
 *
 * Every `build`-only STRING_FLAGS/BOOLEAN_FLAGS entry NOT listed below was
 * deliberately excluded - see the per-field notes.
 */
const ORCHESTRATE_STRING_FLAGS: Array<[input: string, flag: string]> = [
  // build-automation-workflow.ts's runsteps.sh export block: BUILD_NAME,
  // BUILD_METHOD, BUILD_PROFILE, CHOWN_FILES_TO, ANDROID_VERSION_CODE.
  ['buildName', 'buildName'],
  ['buildsPath', 'buildsPath'],
  ['buildMethod', 'buildMethod'],
  ['buildProfile', 'buildProfile'],
  ['androidVersionCode', 'androidVersionCode'],
  ['chownFilesTo', 'chownFilesTo'],
  // Git-auth fields consumed by orchestrator.ts / orchestrator-folders.ts
  // for the repo clone step, independent of provider/Docker.
  ['sshAgent', 'sshAgent'],
  ['sshPublicKeysDirectoryPath', 'sshPublicKeysDirectoryPath'],
  ['gitPrivateToken', 'gitPrivateToken'],

  // --- Excluded, with reasons ---
  // customImage: build-parameters-adapter.ts assigns bp.customImage, but no
  //   local/local-system codepath (provider or workflow) ever reads it back -
  //   it is a Docker image selector with nothing to select on bare host.
  // customParameters: NOT assigned by build-parameters-adapter.ts at all
  //   (unlike `build`'s CUSTOM_PARAMETERS env var). It only appears in the
  //   unrelated hot-runner-service.ts path. Currently a no-op for
  //   local-system, so intentionally not carried forward.
  // versioning / version: the adapter has no `versioningStrategy` concept -
  //   it only accepts an already-resolved `buildVersion` string
  //   (`bp.buildVersion = options.buildVersion || '0.0.1'`), which is a
  //   different contract than this action's "Semantic/Tag/Custom strategy
  //   name" `versioning` input. No existing action input maps cleanly onto
  //   `--buildVersion`, so both are left out pending a real answer upstream.
  // androidExportType/androidKeystoreName/androidKeystoreBase64/
  //   androidKeystorePass/androidKeyaliasName/androidKeyaliasPass/
  //   androidTargetSdkVersion/androidSymbolType: none of these are assigned
  //   by build-parameters-adapter.ts - only androidVersionCode is. Android
  //   signing/export beyond the version code is currently unsupported by
  //   `orchestrate`.
  // dockerCpuLimit/dockerMemoryLimit/dockerIsolationMode/
  //   containerRegistryRepository/containerRegistryImageVersion/
  //   dockerWorkspacePath: Docker container concepts with no bare-host
  //   equivalent (containerRegistry* aren't even assigned by the adapter).
  // unityHubVersionOnMac: not assigned by the adapter at all.
  // unityLicensingServer: per the adapter's own comment, this "flows
  //   opaquely through BuildParameters' index signature ... orchestrator
  //   does not read them" - i.e. it is a no-op for `orchestrate` today;
  //   licensing-server activation is `game-ci activate`'s concern, out of
  //   scope here (matches this file's existing unityVersion/activation
  //   scope boundary).
];

const ORCHESTRATE_BOOLEAN_FLAGS: Array<[input: string, flag: string]> = [
  // build-automation-workflow.ts's runsteps.sh export block: MANUAL_EXIT.
  ['manualExit', 'manualExit'],
  // pre-build-cleanup-service.ts reads this for the dirty-branch check,
  // independent of provider.
  ['allowDirtyBuild', 'allowDirtyBuild'],
  // Explicitly documented upstream (orchestrator-options-plugin.ts,
  // build-parameters-adapter.ts) as "only meaningful for
  // providerStrategy=local(-system)", and exported as SKIP_ACTIVATION in
  // runsteps.sh.
  ['skipActivation', 'skipActivation'],

  // --- Excluded, with reasons ---
  // enableGpu: not assigned anywhere in build-parameters-adapter.ts or the
  //   orchestrator model - a real, currently-unfilled gap versus `build`'s
  //   GPU passthrough, not something to silently pretend to support.
  // useHostNetwork/runAsHostUser: Docker networking/uid-mapping concepts;
  //   not assigned by the adapter, and runAsHostUser is meaningless by
  //   construction on a bare host process that already runs as that host
  //   user.
  // cacheUnityInstallationOnMac: build-parameters-adapter.ts DOES assign
  //   bp.cacheUnityInstallationOnMac, but nothing downstream (no provider,
  //   no workflow) ever reads it back - it's a currently-dead field for
  //   `orchestrate`, so it is not carried forward despite being Mac-native
  //   (i.e. not actually Docker-only) in principle.
  // linux64RemoveExecutableExtension: not assigned by the adapter at all.
];

/**
 * New orchestrator-only inputs surfaced for providerStrategy=local-system.
 * All four are confirmed both registered as `orchestrate` CLI options
 * (orchestrator-options-plugin.ts) and consumed by
 * build-parameters-adapter.ts. `middlewarePipeline` is available in the same
 * places but deliberately deferred - its expected value shape is not yet
 * documented/stable enough to lock into this action's public input surface.
 */
const ORCHESTRATE_ONLY_STRING_FLAGS: Array<[input: string, flag: string]> = [
  ['engineLaunchWrapper', 'engineLaunchWrapper'],
  ['localCacheMode', 'localCacheMode'],
];

const ORCHESTRATE_ONLY_BOOLEAN_FLAGS: Array<[input: string, flag: string]> = [
  ['enableBuildRetry', 'enableBuildRetry'],
  ['localCacheEnabled', 'localCacheEnabled'],
  ['localCacheLibrary', 'localCacheLibrary'],
  ['localCacheLfs', 'localCacheLfs'],
];

function isTruthy(value: string): boolean {
  return value.trim().toLowerCase() === 'true';
}

function pushStringFlags(
  args: string[],
  getInput: (name: string) => string,
  flags: Array<[input: string, flag: string]>,
) {
  for (const [input, flag] of flags) {
    const value = getInput(input);
    // "--flag value" as two argv tokens is ambiguous when value itself
    // starts with "-" (e.g. customParameters="-profile Foo -someBoolean"):
    // yargs sees the next token starting with "-" and assumes the flag
    // takes no value, leaving the value string to be mis-parsed as its own
    // (partly alias-colliding) short-flag cluster. "--flag=value" glues
    // them into one token, which is unambiguous.
    if (value) args.push(`--${flag}=${value}`);
  }
}

function pushBooleanFlags(
  args: string[],
  getInput: (name: string) => string,
  flags: Array<[input: string, flag: string]>,
) {
  for (const [input, flag] of flags) {
    const value = getInput(input);
    if (value && isTruthy(value)) args.push(`--${flag}`);
  }
}

export interface BuildArgsOptions {
  getInput(name: string): string;
}

export function buildCliArgs({ getInput }: BuildArgsOptions): string[] {
  const providerStrategy = getInput('providerStrategy') || 'local';

  if (providerStrategy === 'local-system') {
    return buildOrchestrateArgs(getInput);
  }

  if (providerStrategy !== 'local') {
    throw new Error(
      `Provider strategy "${providerStrategy}" is not supported by this thin wrapper. ` +
        "Use providerStrategy=local, or invoke game-ci/cli's `orchestrate` command directly " +
        'for remote builds.',
    );
  }

  const args: string[] = ['build'];

  const projectPath = getInput('projectPath');
  if (projectPath) args.push(projectPath);

  const targetPlatform = getInput('targetPlatform');
  if (!targetPlatform) {
    throw new Error('targetPlatform is required.');
  }
  args.push(`--targetPlatform=${targetPlatform}`);

  pushStringFlags(args, getInput, STRING_FLAGS);
  pushBooleanFlags(args, getInput, BOOLEAN_FLAGS);

  return args;
}

function buildOrchestrateArgs(getInput: (name: string) => string): string[] {
  const args: string[] = ['orchestrate'];

  const projectPath = getInput('projectPath');
  if (projectPath) args.push(projectPath);

  const targetPlatform = getInput('targetPlatform');
  if (!targetPlatform) {
    throw new Error('targetPlatform is required.');
  }
  args.push(`--targetPlatform=${targetPlatform}`);

  args.push('--providerStrategy=local-system');

  pushStringFlags(args, getInput, ORCHESTRATE_STRING_FLAGS);
  pushStringFlags(args, getInput, ORCHESTRATE_ONLY_STRING_FLAGS);
  pushBooleanFlags(args, getInput, ORCHESTRATE_BOOLEAN_FLAGS);
  pushBooleanFlags(args, getInput, ORCHESTRATE_ONLY_BOOLEAN_FLAGS);

  return args;
}
