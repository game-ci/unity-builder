import fs from 'node:fs';
import path from 'node:path';
import { Cli } from './cli/cli';
import OrchestratorQueryOverride from './orchestrator/options/orchestrator-query-override';
import Platform from './platform';
import GitHub from './github';
import os from 'node:os';

import * as core from '@actions/core';

export type InputKey = keyof typeof Input;

/**
 * Input variables specified in workflows using "with" prop.
 *
 * Note that input is always passed as a string, even booleans.
 *
 * Todo: rename to UserInput and remove anything that is not direct input from the user / ci workflow
 */
class Input {
  public static getInput(query: string): string | undefined {
    if (GitHub.githubInputEnabled) {
      const coreInput = core.getInput(query);
      if (coreInput && coreInput !== '') {
        return coreInput;
      }
    }
    const alternativeQuery = Input.ToEnvVarFormat(query);

    // Query input sources
    if (Cli.query(query, alternativeQuery)) {
      return Cli.query(query, alternativeQuery);
    }

    if (OrchestratorQueryOverride.query(query, alternativeQuery)) {
      return OrchestratorQueryOverride.query(query, alternativeQuery);
    }

    if (process.env[query] !== undefined) {
      return process.env[query]!;
    }

    if (alternativeQuery !== query && process.env[alternativeQuery] !== undefined) {
      return process.env[alternativeQuery]!;
    }
  }

  static get region(): string {
    return Input.getInput('region') ?? 'eu-west-2';
  }

  static get githubRepo(): string | undefined {
    return Input.getInput('GITHUB_REPOSITORY') ?? Input.getInput('GITHUB_REPO') ?? undefined;
  }

  static get branch(): string {
    if (Input.getInput(`GITHUB_REF`)) {
      return Input.getInput(`GITHUB_REF`)!.replace('refs/', '').replace(`head/`, '').replace(`heads/`, '');
    } else if (Input.getInput('branch')) {
      return Input.getInput('branch')!;
    } else {
      return '';
    }
  }

  static get gitSha(): string {
    if (Input.getInput(`GITHUB_SHA`)) {
      return Input.getInput(`GITHUB_SHA`)!;
    } else if (Input.getInput(`GitSHA`)) {
      return Input.getInput(`GitSHA`)!;
    }

    return '';
  }

  static get runNumber(): string {
    return Input.getInput('GITHUB_RUN_NUMBER') ?? '0';
  }

  static get targetPlatform(): string {
    return Input.getInput('targetPlatform') ?? Platform.default;
  }

  static get unityVersion(): string {
    return Input.getInput('unityVersion') ?? 'auto';
  }

  static get customImage(): string {
    return Input.getInput('customImage') ?? '';
  }

  static get projectPath(): string {
    const input = Input.getInput('projectPath');
    let rawProjectPath;

    if (input) {
      rawProjectPath = input;
    } else if (
      fs.existsSync(path.join('test-project', 'ProjectSettings', 'ProjectVersion.txt')) &&
      !fs.existsSync(path.join('ProjectSettings', 'ProjectVersion.txt'))
    ) {
      rawProjectPath = 'test-project';
    } else {
      rawProjectPath = '.';
    }

    return rawProjectPath.replace(/\/$/, '');
  }

  static get buildProfile(): string {
    return Input.getInput('buildProfile') ?? '';
  }

  static get runnerTempPath(): string {
    return Input.getInput('RUNNER_TEMP') ?? '';
  }

  static get buildName(): string {
    return Input.getInput('buildName') ?? Input.targetPlatform;
  }

  static get buildsPath(): string {
    return Input.getInput('buildsPath') ?? 'build';
  }

  static get unityLicensingServer(): string {
    return Input.getInput('unityLicensingServer') ?? '';
  }

  static get buildMethod(): string {
    return Input.getInput('buildMethod') ?? ''; // Processed in docker file
  }

  static get manualExit(): boolean {
    const input = Input.getInput('manualExit') ?? false;

    return input === 'true';
  }

  static get enableGpu(): boolean {
    const input = Input.getInput('enableGpu') ?? false;

    return input === 'true';
  }

  static get customParameters(): string {
    return Input.getInput('customParameters') ?? '';
  }

  static get versioningStrategy(): string {
    return Input.getInput('versioning') ?? 'Semantic';
  }

  static get specifiedVersion(): string {
    return Input.getInput('version') ?? '';
  }

  static get androidVersionCode(): string {
    return Input.getInput('androidVersionCode') ?? '';
  }

  static get androidExportType(): string {
    return Input.getInput('androidExportType') ?? 'androidPackage';
  }

  static get androidKeystoreName(): string {
    return Input.getInput('androidKeystoreName') ?? '';
  }

  static get androidKeystoreBase64(): string {
    return Input.getInput('androidKeystoreBase64') ?? '';
  }

  static get androidKeystorePass(): string {
    return Input.getInput('androidKeystorePass') ?? '';
  }

  static get androidKeyaliasName(): string {
    return Input.getInput('androidKeyaliasName') ?? '';
  }

  static get androidKeyaliasPass(): string {
    return Input.getInput('androidKeyaliasPass') ?? '';
  }

  static get androidTargetSdkVersion(): string {
    return Input.getInput('androidTargetSdkVersion') ?? '';
  }

  static get androidSymbolType(): string {
    return Input.getInput('androidSymbolType') ?? 'none';
  }

  static get sshAgent(): string {
    return Input.getInput('sshAgent') ?? '';
  }

  static get sshPublicKeysDirectoryPath(): string {
    return Input.getInput('sshPublicKeysDirectoryPath') ?? '';
  }

  static get gitPrivateToken(): string | undefined {
    return Input.getInput('gitPrivateToken');
  }

  static get runAsHostUser(): string {
    return Input.getInput('runAsHostUser')?.toLowerCase() ?? 'false';
  }

  static get chownFilesTo() {
    return Input.getInput('chownFilesTo') ?? '';
  }

  static get allowDirtyBuild(): boolean {
    const input = Input.getInput('allowDirtyBuild') ?? false;

    return input === 'true';
  }

  static get cacheUnityInstallationOnMac(): boolean {
    const input = Input.getInput('cacheUnityInstallationOnMac') ?? false;

    return input === 'true';
  }

  static get unityHubVersionOnMac(): string {
    const input = Input.getInput('unityHubVersionOnMac') ?? '';

    return input !== '' ? input : '';
  }

  static get unitySerial(): string | undefined {
    return Input.getInput('UNITY_SERIAL');
  }

  static get unityLicense(): string | undefined {
    return Input.getInput('UNITY_LICENSE');
  }

  static get dockerWorkspacePath(): string {
    return Input.getInput('dockerWorkspacePath') ?? '/github/workspace';
  }

  static get dockerCpuLimit(): string {
    return Input.getInput('dockerCpuLimit') ?? os.cpus().length.toString();
  }

  static get dockerMemoryLimit(): string {
    const bytesInMegabyte = 1024 * 1024;

    let memoryMultiplier;
    switch (os.platform()) {
      case 'linux':
        memoryMultiplier = 0.95;
        break;
      case 'win32':
        memoryMultiplier = 0.8;
        break;
      default:
        memoryMultiplier = 0.75;
        break;
    }

    return (
      Input.getInput('dockerMemoryLimit') ?? `${Math.floor((os.totalmem() / bytesInMegabyte) * memoryMultiplier)}m`
    );
  }

  static get dockerIsolationMode(): string {
    return Input.getInput('dockerIsolationMode') ?? 'default';
  }

  static get containerRegistryRepository(): string {
    return Input.getInput('containerRegistryRepository') ?? 'unityci/editor';
  }

  static get containerRegistryImageVersion(): string {
    return Input.getInput('containerRegistryImageVersion') ?? '3';
  }

  static get skipActivation(): string {
    return Input.getInput('skipActivation')?.toLowerCase() ?? 'false';
  }

  static get submoduleProfilePath(): string {
    return Input.getInput('submoduleProfilePath') ?? '';
  }

  static get submoduleVariantPath(): string {
    return Input.getInput('submoduleVariantPath') ?? '';
  }

  static get submoduleToken(): string {
    return Input.getInput('submoduleToken') ?? '';
  }

  static get localCacheEnabled(): boolean {
    return (Input.getInput('localCacheEnabled') ?? 'false') === 'true';
  }

  static get localCacheRoot(): string {
    return Input.getInput('localCacheRoot') ?? '';
  }

  static get localCacheLibrary(): boolean {
    return (Input.getInput('localCacheLibrary') ?? 'true') === 'true';
  }

  static get localCacheLfs(): boolean {
    return (Input.getInput('localCacheLfs') ?? 'false') === 'true';
  }

  static get childWorkspacesEnabled(): boolean {
    return (Input.getInput('childWorkspacesEnabled') ?? 'false') === 'true';
  }

  static get childWorkspaceName(): string {
    return Input.getInput('childWorkspaceName') ?? '';
  }

  static get childWorkspaceCacheRoot(): string {
    return Input.getInput('childWorkspaceCacheRoot') ?? '';
  }

  static get childWorkspacePreserveGit(): boolean {
    return (Input.getInput('childWorkspacePreserveGit') ?? 'true') === 'true';
  }

  static get childWorkspaceSeparateLibrary(): boolean {
    return (Input.getInput('childWorkspaceSeparateLibrary') ?? 'true') === 'true';
  }

  static get lfsTransferAgent(): string {
    return Input.getInput('lfsTransferAgent') ?? '';
  }

  static get lfsTransferAgentArgs(): string {
    return Input.getInput('lfsTransferAgentArgs') ?? '';
  }

  static get lfsStoragePaths(): string {
    return Input.getInput('lfsStoragePaths') ?? '';
  }

  static get gitHooksEnabled(): boolean {
    return (Input.getInput('gitHooksEnabled') ?? 'false') === 'true';
  }

  static get gitHooksSkipList(): string {
    return Input.getInput('gitHooksSkipList') ?? '';
  }

  static get gitHooksRunBeforeBuild(): string {
    return Input.getInput('gitHooksRunBeforeBuild') ?? '';
  }

  static get providerExecutable(): string {
    return Input.getInput('providerExecutable') ?? '';
  }

  static get gitIntegrityCheck(): boolean {
    const input = Input.getInput('gitIntegrityCheck') ?? 'false';

    return input === 'true';
  }

  static get gitAutoRecover(): boolean {
    const input = Input.getInput('gitAutoRecover') ?? 'false';

    return input === 'true';
  }

  static get cleanReservedFilenames(): boolean {
    const input = Input.getInput('cleanReservedFilenames') ?? 'false';

    return input === 'true';
  }

  static get buildArchiveEnabled(): boolean {
    const input = Input.getInput('buildArchiveEnabled') ?? 'false';

    return input === 'true';
  }

  static get buildArchivePath(): string {
    return Input.getInput('buildArchivePath') ?? './build-archives';
  }

  static get buildArchiveRetention(): number {
    return Number.parseInt(Input.getInput('buildArchiveRetention') ?? '30', 10);
  }

  // GCP Cloud Run (Experimental)
  static get gcpProject(): string {
    return Input.getInput('gcpProject') ?? '';
  }

  static get gcpRegion(): string {
    return Input.getInput('gcpRegion') ?? '';
  }

  static get gcpStorageType(): string {
    return Input.getInput('gcpStorageType') ?? 'gcs-fuse';
  }

  static get gcpBucket(): string {
    return Input.getInput('gcpBucket') ?? '';
  }

  static get gcpFilestoreIp(): string {
    return Input.getInput('gcpFilestoreIp') ?? '';
  }

  static get gcpFilestoreShare(): string {
    return Input.getInput('gcpFilestoreShare') ?? '/share1';
  }

  static get gcpMachineType(): string {
    return Input.getInput('gcpMachineType') ?? 'e2-standard-4';
  }

  static get gcpDiskSizeGb(): string {
    return Input.getInput('gcpDiskSizeGb') ?? '100';
  }

  static get gcpServiceAccount(): string {
    return Input.getInput('gcpServiceAccount') ?? '';
  }

  static get gcpVpcConnector(): string {
    return Input.getInput('gcpVpcConnector') ?? '';
  }

  // Azure Container Instances (Experimental)
  static get azureResourceGroup(): string {
    return Input.getInput('azureResourceGroup') ?? '';
  }

  static get azureLocation(): string {
    return Input.getInput('azureLocation') ?? '';
  }

  static get azureStorageType(): string {
    return Input.getInput('azureStorageType') ?? 'azure-files';
  }

  static get azureStorageAccount(): string {
    return Input.getInput('azureStorageAccount') ?? '';
  }

  static get azureBlobContainer(): string {
    return Input.getInput('azureBlobContainer') ?? 'unity-builds';
  }

  static get azureFileShareName(): string {
    return Input.getInput('azureFileShareName') ?? 'unity-builds';
  }

  static get azureSubscriptionId(): string {
    return Input.getInput('azureSubscriptionId') ?? '';
  }

  static get azureCpu(): string {
    return Input.getInput('azureCpu') ?? '4';
  }

  static get azureMemoryGb(): string {
    return Input.getInput('azureMemoryGb') ?? '16';
  }

  static get azureDiskSizeGb(): string {
    return Input.getInput('azureDiskSizeGb') ?? '100';
  }

  static get azureSubnetId(): string {
    return Input.getInput('azureSubnetId') ?? '';
  }

  // ### ### ###
  // Remote PowerShell provider
  // ### ### ###

  static get remotePowershellHost(): string {
    return Input.getInput('remotePowershellHost') ?? '';
  }

  static get remotePowershellCredential(): string {
    return Input.getInput('remotePowershellCredential') ?? '';
  }

  static get remotePowershellTransport(): string {
    return Input.getInput('remotePowershellTransport') ?? 'wsman';
  }

  // ### ### ###
  // GitHub Actions provider
  // ### ### ###

  static get githubActionsRepo(): string {
    return Input.getInput('githubActionsRepo') ?? '';
  }

  static get githubActionsWorkflow(): string {
    return Input.getInput('githubActionsWorkflow') ?? '';
  }

  static get githubActionsToken(): string {
    return Input.getInput('githubActionsToken') ?? '';
  }

  static get githubActionsRef(): string {
    return Input.getInput('githubActionsRef') ?? 'main';
  }

  // ### ### ###
  // GitLab CI provider
  // ### ### ###

  static get gitlabProjectId(): string {
    return Input.getInput('gitlabProjectId') ?? '';
  }

  static get gitlabTriggerToken(): string {
    return Input.getInput('gitlabTriggerToken') ?? '';
  }

  static get gitlabApiUrl(): string {
    return Input.getInput('gitlabApiUrl') ?? 'https://gitlab.com';
  }

  static get gitlabRef(): string {
    return Input.getInput('gitlabRef') ?? 'main';
  }

  // ### ### ###
  // Ansible provider
  // ### ### ###

  static get ansibleInventory(): string {
    return Input.getInput('ansibleInventory') ?? '';
  }

  static get ansiblePlaybook(): string {
    return Input.getInput('ansiblePlaybook') ?? '';
  }

  static get ansibleExtraVars(): string {
    return Input.getInput('ansibleExtraVars') ?? '';
  }

  static get ansibleVaultPassword(): string {
    return Input.getInput('ansibleVaultPassword') ?? '';
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

export default Input;
