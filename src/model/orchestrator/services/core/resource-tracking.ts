import OrchestratorLogger from './orchestrator-logger';
import OrchestratorOptions from '../../options/orchestrator-options';
import Orchestrator from '../../orchestrator';
import { OrchestratorSystem } from './orchestrator-system';

class ResourceTracking {
  static isEnabled(): boolean {
    return (
      OrchestratorOptions.resourceTracking ||
      OrchestratorOptions.orchestratorDebug ||
      process.env['orchestratorTests'] === 'true'
    );
  }

  static logAllocationSummary(context: string) {
    if (!ResourceTracking.isEnabled()) {
      return;
    }

    const buildParameters = Orchestrator.buildParameters;
    const allocations = {
      providerStrategy: buildParameters.providerStrategy,
      containerCpu: buildParameters.containerCpu,
      containerMemory: buildParameters.containerMemory,
      dockerCpuLimit: buildParameters.dockerCpuLimit,
      dockerMemoryLimit: buildParameters.dockerMemoryLimit,
      kubeVolumeSize: buildParameters.kubeVolumeSize,
      kubeStorageClass: buildParameters.kubeStorageClass,
      kubeVolume: buildParameters.kubeVolume,
      containerNamespace: buildParameters.containerNamespace,
      storageProvider: buildParameters.storageProvider,
      rcloneRemote: buildParameters.rcloneRemote,
      dockerWorkspacePath: buildParameters.dockerWorkspacePath,
      cacheKey: buildParameters.cacheKey,
      maxRetainedWorkspaces: buildParameters.maxRetainedWorkspaces,
      useCompressionStrategy: buildParameters.useCompressionStrategy,
      useLargePackages: buildParameters.useLargePackages,
      ephemeralStorageRequest: process.env['orchestratorTests'] === 'true' ? 'not set' : '2Gi',
    };

    OrchestratorLogger.log(`[ResourceTracking] Allocation summary (${context}):`);
    OrchestratorLogger.log(JSON.stringify(allocations, undefined, 2));
  }

  static async logDiskUsageSnapshot(context: string) {
    if (!ResourceTracking.isEnabled()) {
      return;
    }

    OrchestratorLogger.log(`[ResourceTracking] Disk usage snapshot (${context})`);
    await ResourceTracking.runAndLog('df -h', 'df -h');
    await ResourceTracking.runAndLog('du -sh .', 'du -sh .');
    await ResourceTracking.runAndLog('du -sh ./orchestrator-cache', 'du -sh ./orchestrator-cache');
    await ResourceTracking.runAndLog('du -sh ./temp', 'du -sh ./temp');
    await ResourceTracking.runAndLog('du -sh ./logs', 'du -sh ./logs');
  }

  static async logK3dNodeDiskUsage(context: string) {
    if (!ResourceTracking.isEnabled()) {
      return;
    }

    const nodes = ['k3d-unity-builder-agent-0', 'k3d-unity-builder-server-0'];
    OrchestratorLogger.log(`[ResourceTracking] K3d node disk usage (${context})`);
    for (const node of nodes) {
      await ResourceTracking.runAndLog(
        `k3d node ${node}`,
        `docker exec ${node} sh -c "df -h /var/lib/rancher/k3s 2>/dev/null || df -h / 2>/dev/null || true" || true`,
      );
    }
  }

  private static async runAndLog(label: string, command: string) {
    try {
      const output = await OrchestratorSystem.Run(command, true, true);
      const trimmed = output.trim();
      OrchestratorLogger.log(`[ResourceTracking] ${label}:\n${trimmed || 'no output'}`);
    } catch (error: any) {
      OrchestratorLogger.log(`[ResourceTracking] ${label} failed: ${error?.message || error}`);
    }
  }
}

export default ResourceTracking;
