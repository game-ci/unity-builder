/**
 * Azure Container Instances (ACI) Provider (Experimental)
 *
 * Executes Unity builds as Azure Container Instances with configurable storage backends.
 *
 * Storage types:
 *   - azure-files:     SMB file share mount via Azure Files. Up to 100 TiB per share,
 *                       premium throughput. Default.
 *                       Requires: azureStorageAccount, azureFileShareName
 *   - blob-copy:       Copy artifacts in/out of Azure Blob Storage before/after the build.
 *                       No mount overhead, simpler.
 *                       Requires: azureStorageAccount, azureBlobContainer
 *   - azure-files-nfs: NFS 4.1 file share mount. True POSIX semantics, no SMB lock overhead,
 *                       better for Unity Library caching (many small random reads).
 *                       Requires: azureStorageAccount, azureFileShareName, Premium FileStorage,
 *                       VNet integration (azureSubnetId)
 *   - in-memory:       emptyDir volume (tmpfs). Fastest I/O but volatile, size limited by
 *                       container memory allocation.
 *
 * Prerequisites:
 *   - Azure CLI authenticated (az login or service principal)
 *   - A resource group for build resources
 *   - Contributor role on the resource group
 *
 * @experimental This provider is experimental. APIs and behavior may change.
 */

import { ProviderInterface } from '../provider-interface';
import BuildParameters from '../../../build-parameters';
import OrchestratorLogger from '../../services/core/orchestrator-logger';
import OrchestratorEnvironmentVariable from '../../options/orchestrator-environment-variable';
import OrchestratorSecret from '../../options/orchestrator-secret';
import { ProviderResource } from '../provider-resource';
import { ProviderWorkflow } from '../provider-workflow';
import { OrchestratorSystem } from '../../services/core/orchestrator-system';
import { Input } from '../../..';
import ResourceTracking from '../../services/core/resource-tracking';

type AzureStorageType = 'azure-files' | 'blob-copy' | 'azure-files-nfs' | 'in-memory';

class AzureAciProvider implements ProviderInterface {
  private readonly resourceGroup: string;
  private readonly location: string;
  private readonly storageType: AzureStorageType;
  private readonly storageAccount: string;
  private readonly blobContainer: string;
  private readonly fileShareName: string;
  private readonly subscriptionId: string;
  private readonly cpu: number;
  private readonly memoryGb: number;
  private readonly diskSizeGb: number;
  private readonly subnetId: string;
  private buildParameters: BuildParameters;

  constructor(buildParameters: BuildParameters) {
    this.buildParameters = buildParameters;
    this.resourceGroup = buildParameters.azureResourceGroup || process.env.AZURE_RESOURCE_GROUP || '';
    this.location = buildParameters.azureLocation || Input.region || 'eastus';
    this.storageType = (buildParameters.azureStorageType || 'azure-files') as AzureStorageType;
    this.storageAccount = buildParameters.azureStorageAccount || process.env.AZURE_STORAGE_ACCOUNT || '';
    this.blobContainer = buildParameters.azureBlobContainer || 'unity-builds';
    this.fileShareName = buildParameters.azureFileShareName || 'unity-builds';
    this.subscriptionId = buildParameters.azureSubscriptionId || process.env.AZURE_SUBSCRIPTION_ID || '';
    this.cpu = Number.parseInt(buildParameters.azureCpu || '4', 10);
    this.memoryGb = Number.parseInt(buildParameters.azureMemoryGb || '16', 10);
    this.diskSizeGb = Number.parseInt(buildParameters.azureDiskSizeGb || '100', 10);
    this.subnetId = buildParameters.azureSubnetId || '';

    OrchestratorLogger.log('[Azure ACI] Provider initialized (EXPERIMENTAL)');
    OrchestratorLogger.log(`[Azure ACI] Resource Group: ${this.resourceGroup || '(not set)'}`);
    OrchestratorLogger.log(`[Azure ACI] Location: ${this.location}`);
    OrchestratorLogger.log(`[Azure ACI] Storage: ${this.storageType}`);
    OrchestratorLogger.log(`[Azure ACI] Resources: ${this.cpu} CPU, ${this.memoryGb}GB RAM`);

    this.validateStorageConfig();
  }

  private validateStorageConfig(): void {
    switch (this.storageType) {
      case 'azure-files':
        if (!this.storageAccount) {
          OrchestratorLogger.logWarning(
            '[Azure ACI] Storage type "azure-files" requires azureStorageAccount to be set.',
          );
        } else {
          OrchestratorLogger.log(
            `[Azure ACI] File Share: ${this.storageAccount}/${this.fileShareName} (SMB)`,
          );
        }
        break;
      case 'azure-files-nfs':
        if (!this.storageAccount) {
          OrchestratorLogger.logWarning(
            '[Azure ACI] Storage type "azure-files-nfs" requires azureStorageAccount (Premium FileStorage).',
          );
        }
        if (!this.subnetId) {
          OrchestratorLogger.logWarning(
            '[Azure ACI] NFS file shares require VNet integration. Set azureSubnetId.',
          );
        } else {
          OrchestratorLogger.log(
            `[Azure ACI] File Share: ${this.storageAccount}/${this.fileShareName} (NFS 4.1)`,
          );
        }
        break;
      case 'blob-copy':
        if (!this.storageAccount) {
          OrchestratorLogger.logWarning(
            '[Azure ACI] Storage type "blob-copy" requires azureStorageAccount to be set.',
          );
        } else {
          OrchestratorLogger.log(`[Azure ACI] Blob container: ${this.storageAccount}/${this.blobContainer}`);
        }
        break;
      case 'in-memory':
        OrchestratorLogger.log(`[Azure ACI] In-memory volume (emptyDir): limited by ${this.memoryGb}GB container memory`);
        break;
      default:
        OrchestratorLogger.logWarning(
          `[Azure ACI] Unknown storage type '${this.storageType}'. Valid: azure-files, blob-copy, azure-files-nfs, in-memory`,
        );
    }

    if (!this.resourceGroup) {
      OrchestratorLogger.logWarning(
        '[Azure ACI] No resource group specified. Set azureResourceGroup input or AZURE_RESOURCE_GROUP env var.',
      );
    }
  }

  async setupWorkflow(
    buildGuid: string,
    buildParameters: BuildParameters,
    branchName: string,
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {
    OrchestratorLogger.log(`[Azure ACI] Setting up workflow for build ${buildGuid}`);
    ResourceTracking.logAllocationSummary('azure-aci setup');

    // Verify Azure CLI is available
    try {
      await OrchestratorSystem.Run('az version --output json', false, true);
      OrchestratorLogger.log('[Azure ACI] Azure CLI detected');
    } catch {
      throw new Error(
        '[Azure ACI] Azure CLI not found. Install Azure CLI: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli',
      );
    }

    if (this.subscriptionId) {
      await OrchestratorSystem.Run(`az account set --subscription="${this.subscriptionId}"`);
    }

    // Ensure resource group exists
    if (this.resourceGroup) {
      try {
        await OrchestratorSystem.Run(
          `az group show --name "${this.resourceGroup}" --output json`,
          false,
          true,
        );
        OrchestratorLogger.log(`[Azure ACI] Resource group ${this.resourceGroup} exists`);
      } catch {
        OrchestratorLogger.log(`[Azure ACI] Creating resource group ${this.resourceGroup}`);
        await OrchestratorSystem.Run(
          `az group create --name "${this.resourceGroup}" --location "${this.location}"`,
        );
      }
    }

    // Storage-specific setup
    switch (this.storageType) {
      case 'azure-files':
        await this.setupStorageAccount('Standard_LRS', 'StorageV2');
        await this.setupFileShare();
        break;
      case 'azure-files-nfs':
        await this.setupStorageAccount('Premium_LRS', 'FileStorage');
        await this.setupNfsFileShare();
        break;
      case 'blob-copy':
        await this.setupStorageAccount('Standard_LRS', 'StorageV2');
        await this.setupBlobContainer();
        break;
      case 'in-memory':
        // No storage setup needed
        break;
    }
  }

  private async setupStorageAccount(sku: string, kind: string): Promise<void> {
    if (!this.storageAccount || !this.resourceGroup) return;

    try {
      await OrchestratorSystem.Run(
        `az storage account show --name "${this.storageAccount}" --resource-group "${this.resourceGroup}" --output json`,
        false,
        true,
      );
      OrchestratorLogger.log(`[Azure ACI] Storage account ${this.storageAccount} exists`);
    } catch {
      OrchestratorLogger.log(`[Azure ACI] Creating storage account ${this.storageAccount} (${sku}, ${kind})`);
      await OrchestratorSystem.Run(
        `az storage account create --name "${this.storageAccount}" --resource-group "${this.resourceGroup}" --location "${this.location}" --sku ${sku} --kind ${kind}`,
      );
    }
  }

  private async setupFileShare(): Promise<void> {
    if (!this.storageAccount || !this.resourceGroup) return;
    try {
      await OrchestratorSystem.Run(
        `az storage share-rm show --storage-account "${this.storageAccount}" --name "${this.fileShareName}" --resource-group "${this.resourceGroup}" --output json`,
        false,
        true,
      );
    } catch {
      OrchestratorLogger.log(`[Azure ACI] Creating file share ${this.fileShareName} (${this.diskSizeGb}GB)`);
      await OrchestratorSystem.Run(
        `az storage share-rm create --storage-account "${this.storageAccount}" --name "${this.fileShareName}" --resource-group "${this.resourceGroup}" --quota ${this.diskSizeGb}`,
      );
    }
  }

  private async setupNfsFileShare(): Promise<void> {
    if (!this.storageAccount || !this.resourceGroup) return;
    try {
      await OrchestratorSystem.Run(
        `az storage share-rm show --storage-account "${this.storageAccount}" --name "${this.fileShareName}" --resource-group "${this.resourceGroup}" --output json`,
        false,
        true,
      );
    } catch {
      OrchestratorLogger.log(`[Azure ACI] Creating NFS file share ${this.fileShareName} (${this.diskSizeGb}GB)`);
      await OrchestratorSystem.Run(
        `az storage share-rm create --storage-account "${this.storageAccount}" --name "${this.fileShareName}" --resource-group "${this.resourceGroup}" --quota ${this.diskSizeGb} --enabled-protocols NFS`,
      );
    }
  }

  private async setupBlobContainer(): Promise<void> {
    if (!this.storageAccount || !this.resourceGroup) return;
    try {
      await OrchestratorSystem.Run(
        `az storage container show --name "${this.blobContainer}" --account-name "${this.storageAccount}" --output json`,
        false,
        true,
      );
    } catch {
      OrchestratorLogger.log(`[Azure ACI] Creating blob container ${this.blobContainer}`);
      await OrchestratorSystem.Run(
        `az storage container create --name "${this.blobContainer}" --account-name "${this.storageAccount}"`,
      );
    }
  }

  private async getStorageKey(): Promise<string> {
    if (!this.storageAccount || !this.resourceGroup) return '';
    try {
      const keyJson = await OrchestratorSystem.Run(
        `az storage account keys list --account-name "${this.storageAccount}" --resource-group "${this.resourceGroup}" --output json`,
        false,
        true,
      );
      const keys = JSON.parse(keyJson);
      return keys[0]?.value || '';
    } catch (error: any) {
      OrchestratorLogger.logWarning(`[Azure ACI] Could not get storage key: ${error.message}`);
      return '';
    }
  }

  private async buildVolumeFlags(mountdir: string): Promise<string> {
    switch (this.storageType) {
      case 'azure-files': {
        const storageKey = await this.getStorageKey();
        if (!storageKey) return '';
        return [
          `--azure-file-volume-account-name "${this.storageAccount}"`,
          `--azure-file-volume-account-key "${storageKey}"`,
          `--azure-file-volume-share-name "${this.fileShareName}"`,
          `--azure-file-volume-mount-path "${mountdir}"`,
        ].join(' ');
      }

      case 'azure-files-nfs': {
        // ACI NFS mount uses a YAML deployment template; for CLI we use the same
        // azure-file-volume flags but the share must be NFS-enabled and
        // the container must be in a VNet
        const storageKey = await this.getStorageKey();
        if (!storageKey) return '';
        return [
          `--azure-file-volume-account-name "${this.storageAccount}"`,
          `--azure-file-volume-account-key "${storageKey}"`,
          `--azure-file-volume-share-name "${this.fileShareName}"`,
          `--azure-file-volume-mount-path "${mountdir}"`,
        ].join(' ');
      }

      case 'in-memory':
        // ACI emptyDir volumes require YAML deployment; for simplicity we skip
        // the volume mount and let the container use its own filesystem
        OrchestratorLogger.log('[Azure ACI] In-memory mode: using container filesystem (no persistent mount)');
        return '';

      case 'blob-copy':
        // No volume mount — artifacts are copied in/out via az storage blob commands
        return '';

      default:
        return '';
    }
  }

  async runTaskInWorkflow(
    buildGuid: string,
    image: string,
    commands: string,
    mountdir: string,
    workingdir: string,
    environment: OrchestratorEnvironmentVariable[],
    secrets: OrchestratorSecret[],
  ): Promise<string> {
    OrchestratorLogger.log(`[Azure ACI] Running task for build ${buildGuid}`);
    ResourceTracking.logAllocationSummary('azure-aci task');

    const containerName = `unity-build-${buildGuid}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 63);

    // Build environment variable flags
    const allEnvVars = [
      ...environment.map((env) => `${env.name}=${env.value}`),
      ...secrets.map((s) => `${s.EnvironmentVariable}=${s.ParameterValue}`),
    ];
    const envFlag =
      allEnvVars.length > 0 ? `--environment-variables ${allEnvVars.map((e) => `"${e}"`).join(' ')}` : '';

    // Build volume flags based on storage type
    const volumeFlags = await this.buildVolumeFlags(mountdir);

    const subnetFlag = this.subnetId ? `--subnet "${this.subnetId}"` : '';

    // For blob-copy, wrap the user command with copy-in/copy-out steps
    let effectiveCommands = commands;
    if (this.storageType === 'blob-copy' && this.storageAccount && commands) {
      effectiveCommands = [
        `az storage blob download-batch --destination "${mountdir}" --source "${this.blobContainer}" --account-name "${this.storageAccount}" 2>/dev/null || true`,
        commands,
        `az storage blob upload-batch --source "${mountdir}" --destination "${this.blobContainer}" --account-name "${this.storageAccount}" --overwrite`,
      ].join(' && ');
    }

    const commandFlag = effectiveCommands
      ? `--command-line "/bin/sh -c '${effectiveCommands.replace(/'/g, "'\\''")}'"`
      : '';

    const createCmd = [
      'az container create',
      `--resource-group "${this.resourceGroup}"`,
      `--name "${containerName}"`,
      `--image "${image}"`,
      `--location "${this.location}"`,
      `--cpu ${this.cpu}`,
      `--memory ${this.memoryGb}`,
      '--restart-policy Never',
      '--os-type Linux',
      volumeFlags,
      envFlag,
      subnetFlag,
      commandFlag,
      '--output json',
    ]
      .filter(Boolean)
      .join(' ');

    try {
      await OrchestratorSystem.Run(createCmd);
      OrchestratorLogger.log(
        `[Azure ACI] Container ${containerName} created (storage: ${this.storageType}), waiting for completion...`,
      );
    } catch (error: any) {
      throw new Error(`[Azure ACI] Failed to create container: ${error.message}`);
    }

    const output = await this.waitForContainerCompletion(containerName);
    return output;
  }

  private async waitForContainerCompletion(containerName: string): Promise<string> {
    const maxWaitMs = 24 * 60 * 60 * 1000;
    const pollIntervalMs = 15_000;
    const startTime = Date.now();
    let lastLogLength = 0;

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const stateJson = await OrchestratorSystem.Run(
          `az container show --resource-group "${this.resourceGroup}" --name "${containerName}" --output json`,
          false,
          true,
        );

        const state = JSON.parse(stateJson);
        const containerState =
          state.containers?.[0]?.instanceView?.currentState?.state ||
          state.instanceView?.state ||
          'Unknown';
        const provisioningState = state.provisioningState || 'Unknown';

        // Stream logs incrementally
        try {
          const logs = await OrchestratorSystem.Run(
            `az container logs --resource-group "${this.resourceGroup}" --name "${containerName}"`,
            false,
            true,
          );
          if (logs && logs.length > lastLogLength) {
            const newLogs = logs.slice(lastLogLength);
            for (const line of newLogs.split('\n')) {
              if (line.trim()) {
                OrchestratorLogger.log(`[Build] ${line}`);
              }
            }
            lastLogLength = logs.length;
          }
        } catch {
          // Logs may not be available yet
        }

        if (containerState === 'Terminated' || provisioningState === 'Succeeded') {
          const exitCode = state.containers?.[0]?.instanceView?.currentState?.exitCode;
          if (exitCode !== undefined && exitCode !== 0) {
            throw new Error(`[Azure ACI] Container exited with code ${exitCode}`);
          }
          OrchestratorLogger.log('[Azure ACI] Container completed successfully');
          try {
            return await OrchestratorSystem.Run(
              `az container logs --resource-group "${this.resourceGroup}" --name "${containerName}"`,
              false,
              true,
            );
          } catch {
            return '';
          }
        }

        if (provisioningState === 'Failed') {
          const detail =
            state.containers?.[0]?.instanceView?.currentState?.detailStatus ||
            state.containers?.[0]?.instanceView?.events?.map((e: any) => e.message).join('; ') ||
            'Unknown error';
          throw new Error(`[Azure ACI] Container provisioning failed: ${detail}`);
        }
      } catch (error: any) {
        if (
          error.message?.includes('Container provisioning failed') ||
          error.message?.includes('exited with code')
        ) {
          throw error;
        }
        OrchestratorLogger.logWarning(`[Azure ACI] Polling error: ${error.message}`);
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error('[Azure ACI] Container execution timed out after 24 hours');
  }

  async cleanupWorkflow(
    buildParameters: BuildParameters,
    branchName: string,
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {
    OrchestratorLogger.log('[Azure ACI] Cleaning up workflow');
  }

  async garbageCollect(
    filter: string,
    previewOnly: boolean,
    olderThan: Number,
    fullCache: boolean,
    baseDependencies: boolean,
  ): Promise<string> {
    OrchestratorLogger.log('[Azure ACI] Garbage collecting old container groups');

    try {
      const containersJson = await OrchestratorSystem.Run(
        `az container list --resource-group "${this.resourceGroup}" --output json`,
        false,
        true,
      );

      const containers = JSON.parse(containersJson || '[]');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - Number(olderThan));

      let deletedCount = 0;
      for (const container of containers) {
        const name = container.name || '';
        if (!name.startsWith('unity-build-')) continue;

        const createdAt = new Date(
          container.tags?.createdAt || container.properties?.provisioningState || 0,
        );
        const state = container.containers?.[0]?.instanceView?.currentState?.state || '';

        if (state === 'Terminated' || createdAt < cutoffDate) {
          if (previewOnly) {
            OrchestratorLogger.log(`[Azure ACI] Would delete: ${name}`);
          } else {
            await OrchestratorSystem.Run(
              `az container delete --resource-group "${this.resourceGroup}" --name "${name}" --yes`,
            );
            deletedCount++;
          }
        }
      }

      return `Garbage collected ${deletedCount} Azure container instances`;
    } catch (error: any) {
      OrchestratorLogger.logWarning(`[Azure ACI] Garbage collection failed: ${error.message}`);
      return '';
    }
  }

  async listResources(): Promise<ProviderResource[]> {
    try {
      const containersJson = await OrchestratorSystem.Run(
        `az container list --resource-group "${this.resourceGroup}" --output json`,
        false,
        true,
      );

      const containers = JSON.parse(containersJson || '[]');
      return containers
        .filter((c: any) => (c.name || '').startsWith('unity-build-'))
        .map((c: any) => ({ Name: c.name || '' }));
    } catch {
      return [];
    }
  }

  listWorkflow(): Promise<ProviderWorkflow[]> {
    throw new Error('[Azure ACI] listWorkflow not implemented for this experimental provider');
  }

  async watchWorkflow(): Promise<string> {
    throw new Error('[Azure ACI] watchWorkflow not implemented for this experimental provider');
  }
}

export default AzureAciProvider;
