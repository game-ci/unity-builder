/**
 * Azure Container Instances (ACI) Provider (Experimental)
 *
 * Executes Unity builds as Azure Container Instances with Azure File Shares for large storage.
 *
 * Prerequisites:
 *   - Azure CLI authenticated (az login or service principal)
 *   - A resource group for build resources
 *   - An Azure Storage Account with a File Share for build artifacts
 *   - Contributor role on the resource group
 *
 * Architecture:
 *   - Uses Azure Container Instances for serverless container execution
 *   - Azure File Shares mounted as volumes for large artifact I/O (up to 100 TiB per share)
 *   - Container logs streamed via Azure Monitor / az container logs
 *   - Supports up to 16 CPU cores and 16 GB memory per container group
 *   - Premium file shares support up to 10 GiB/s throughput
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

class AzureAciProvider implements ProviderInterface {
  private readonly resourceGroup: string;
  private readonly location: string;
  private readonly storageAccount: string;
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
    this.storageAccount = buildParameters.azureStorageAccount || process.env.AZURE_STORAGE_ACCOUNT || '';
    this.fileShareName = buildParameters.azureFileShareName || 'unity-builds';
    this.subscriptionId = buildParameters.azureSubscriptionId || process.env.AZURE_SUBSCRIPTION_ID || '';
    this.cpu = Number.parseInt(buildParameters.azureCpu || '4', 10);
    this.memoryGb = Number.parseInt(buildParameters.azureMemoryGb || '16', 10);
    this.diskSizeGb = Number.parseInt(buildParameters.azureDiskSizeGb || '100', 10);
    this.subnetId = buildParameters.azureSubnetId || '';

    OrchestratorLogger.log('[Azure ACI] Provider initialized (EXPERIMENTAL)');
    OrchestratorLogger.log(`[Azure ACI] Resource Group: ${this.resourceGroup || '(not set)'}`);
    OrchestratorLogger.log(`[Azure ACI] Location: ${this.location}`);
    OrchestratorLogger.log(`[Azure ACI] Storage Account: ${this.storageAccount || '(not set)'}`);
    OrchestratorLogger.log(`[Azure ACI] File Share: ${this.fileShareName}`);
    OrchestratorLogger.log(`[Azure ACI] Resources: ${this.cpu} CPU, ${this.memoryGb}GB RAM`);

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
      OrchestratorLogger.log(`[Azure ACI] Azure CLI detected`);
    } catch {
      throw new Error(
        '[Azure ACI] Azure CLI not found. Install Azure CLI: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli',
      );
    }

    // Set subscription if specified
    if (this.subscriptionId) {
      await OrchestratorSystem.Run(`az account set --subscription="${this.subscriptionId}"`);
    }

    // Verify resource group exists
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

    // Setup storage account and file share if specified
    if (this.storageAccount) {
      try {
        await OrchestratorSystem.Run(
          `az storage account show --name "${this.storageAccount}" --resource-group "${this.resourceGroup}" --output json`,
          false,
          true,
        );
        OrchestratorLogger.log(`[Azure ACI] Storage account ${this.storageAccount} exists`);
      } catch {
        OrchestratorLogger.log(`[Azure ACI] Creating storage account ${this.storageAccount}`);
        await OrchestratorSystem.Run(
          `az storage account create --name "${this.storageAccount}" --resource-group "${this.resourceGroup}" --location "${this.location}" --sku Premium_LRS --kind FileStorage`,
        );
      }

      // Get storage account key
      const keyJson = await OrchestratorSystem.Run(
        `az storage account keys list --account-name "${this.storageAccount}" --resource-group "${this.resourceGroup}" --output json`,
        false,
        true,
      );
      const keys = JSON.parse(keyJson);
      const storageKey = keys[0]?.value || '';

      // Create file share if it doesn't exist
      try {
        await OrchestratorSystem.Run(
          `az storage share-rm show --storage-account "${this.storageAccount}" --name "${this.fileShareName}" --resource-group "${this.resourceGroup}" --output json`,
          false,
          true,
        );
      } catch {
        OrchestratorLogger.log(`[Azure ACI] Creating file share ${this.fileShareName}`);
        await OrchestratorSystem.Run(
          `az storage share-rm create --storage-account "${this.storageAccount}" --name "${this.fileShareName}" --resource-group "${this.resourceGroup}" --quota ${this.diskSizeGb}`,
        );
      }
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
    const envFlag = allEnvVars.length > 0 ? `--environment-variables ${allEnvVars.map((e) => `"${e}"`).join(' ')}` : '';

    // Get storage account key for volume mount
    let volumeFlags = '';
    if (this.storageAccount && this.resourceGroup) {
      try {
        const keyJson = await OrchestratorSystem.Run(
          `az storage account keys list --account-name "${this.storageAccount}" --resource-group "${this.resourceGroup}" --output json`,
          false,
          true,
        );
        const keys = JSON.parse(keyJson);
        const storageKey = keys[0]?.value || '';

        if (storageKey) {
          volumeFlags = [
            `--azure-file-volume-account-name "${this.storageAccount}"`,
            `--azure-file-volume-account-key "${storageKey}"`,
            `--azure-file-volume-share-name "${this.fileShareName}"`,
            `--azure-file-volume-mount-path "${mountdir}"`,
          ].join(' ');
        }
      } catch (error: any) {
        OrchestratorLogger.logWarning(`[Azure ACI] Could not get storage key: ${error.message}`);
      }
    }

    // Subnet flag for VNet integration
    const subnetFlag = this.subnetId ? `--subnet "${this.subnetId}"` : '';

    // Build the command override
    const commandFlag = commands ? `--command-line "/bin/sh -c '${commands.replace(/'/g, "'\\''")}'\"` : '';

    // Create and run the container instance
    const createCmd = [
      'az container create',
      `--resource-group "${this.resourceGroup}"`,
      `--name "${containerName}"`,
      `--image "${image}"`,
      `--location "${this.location}"`,
      `--cpu ${this.cpu}`,
      `--memory ${this.memoryGb}`,
      `--restart-policy Never`,
      `--os-type Linux`,
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
      OrchestratorLogger.log(`[Azure ACI] Container ${containerName} created, waiting for completion...`);
    } catch (error: any) {
      throw new Error(`[Azure ACI] Failed to create container: ${error.message}`);
    }

    // Poll for completion
    const output = await this.waitForContainerCompletion(containerName);

    return output;
  }

  private async waitForContainerCompletion(containerName: string): Promise<string> {
    const maxWaitMs = 24 * 60 * 60 * 1000; // 24 hours
    const pollIntervalMs = 15_000;
    const startTime = Date.now();
    let lastLogLength = 0;

    while (Date.now() - startTime < maxWaitMs) {
      try {
        // Check container state
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

        // Stream logs
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

        // Check if completed
        if (containerState === 'Terminated' || provisioningState === 'Succeeded') {
          const exitCode = state.containers?.[0]?.instanceView?.currentState?.exitCode;
          if (exitCode !== undefined && exitCode !== 0) {
            throw new Error(`[Azure ACI] Container exited with code ${exitCode}`);
          }
          OrchestratorLogger.log(`[Azure ACI] Container completed successfully`);

          // Get final logs
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
        if (error.message?.includes('Container provisioning failed') || error.message?.includes('exited with code')) {
          throw error;
        }
        OrchestratorLogger.logWarning(`[Azure ACI] Polling error: ${error.message}`);
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error('[Azure ACI] Container execution timed out after 24 hours');
  }

  async cleanupWorkflow(
    buildParameters: BuildParameters,
    branchName: string,
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {
    OrchestratorLogger.log(`[Azure ACI] Cleaning up workflow`);
    // ACI containers with restart-policy=Never auto-stop; cleanup is done during garbage collection
  }

  async garbageCollect(
    filter: string,
    previewOnly: boolean,
    olderThan: Number,
    fullCache: boolean,
    baseDependencies: boolean,
  ): Promise<string> {
    OrchestratorLogger.log(`[Azure ACI] Garbage collecting old container groups`);

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

        const createdAt = new Date(container.tags?.createdAt || container.properties?.provisioningState || 0);
        const state = container.containers?.[0]?.instanceView?.currentState?.state || '';

        // Delete terminated containers older than the threshold
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
