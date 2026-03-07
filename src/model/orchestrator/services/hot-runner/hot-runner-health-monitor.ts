import OrchestratorLogger from '../core/orchestrator-logger';
import { HotRunnerRegistry } from './hot-runner-registry';
import { HotRunnerTransport } from './hot-runner-types';

export class HotRunnerHealthMonitor {
  private intervalHandle: ReturnType<typeof setInterval> | undefined;
  private registry: HotRunnerRegistry | undefined;
  private transports: Map<string, HotRunnerTransport> = new Map();

  /**
   * Start periodic health monitoring for all registered runners.
   */
  startMonitoring(registry: HotRunnerRegistry, interval: number, transports: Map<string, HotRunnerTransport>): void {
    if (this.intervalHandle) {
      this.stopMonitoring();
    }

    this.registry = registry;
    this.transports = transports;

    OrchestratorLogger.log(`[HotRunner] Starting health monitoring (interval: ${interval}s)`);

    this.intervalHandle = setInterval(() => {
      this.runHealthChecks().catch((error: any) => {
        OrchestratorLogger.logWarning(`[HotRunner] Health check cycle failed: ${error.message}`);
      });
    }, interval * 1000);
  }

  /**
   * Stop periodic health monitoring.
   */
  stopMonitoring(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
      OrchestratorLogger.log(`[HotRunner] Health monitoring stopped`);
    }
  }

  /**
   * Check health of a specific runner by ID. Returns true if healthy.
   */
  async checkHealth(runnerId: string): Promise<boolean> {
    if (!this.registry) {
      return false;
    }

    const transport = this.transports.get(runnerId);
    if (!transport) {
      OrchestratorLogger.logWarning(`[HotRunner] No transport for runner ${runnerId}`);
      this.registry.updateRunner(runnerId, {
        state: 'unhealthy',
        lastHealthCheck: new Date().toISOString(),
      });

      return false;
    }

    try {
      const healthy = await transport.healthCheck();
      if (healthy) {
        const status = await transport.getStatus();
        this.registry.updateRunner(runnerId, {
          lastHealthCheck: new Date().toISOString(),
          memoryUsageMB: status.memoryUsageMB,
          uptime: status.uptime,
          libraryHash: status.libraryHash,
        });

        return true;
      }

      OrchestratorLogger.logWarning(`[HotRunner] Runner ${runnerId} health check returned false`);
      this.registry.updateRunner(runnerId, {
        state: 'unhealthy',
        lastHealthCheck: new Date().toISOString(),
      });

      return false;
    } catch (error: any) {
      OrchestratorLogger.logWarning(`[HotRunner] Runner ${runnerId} health check failed: ${error.message}`);
      this.registry.updateRunner(runnerId, {
        state: 'unhealthy',
        lastHealthCheck: new Date().toISOString(),
      });

      return false;
    }
  }

  /**
   * Mark an unhealthy runner for cleanup and disconnect its transport.
   */
  async recycleUnhealthyRunner(runnerId: string): Promise<void> {
    if (!this.registry) {
      return;
    }

    OrchestratorLogger.log(`[HotRunner] Recycling unhealthy runner ${runnerId}`);
    this.registry.updateRunner(runnerId, { state: 'stopping' });

    const transport = this.transports.get(runnerId);
    if (transport) {
      try {
        await transport.disconnect();
      } catch (error: any) {
        OrchestratorLogger.logWarning(`[HotRunner] Error disconnecting runner ${runnerId}: ${error.message}`);
      }
      this.transports.delete(runnerId);
    }

    this.registry.unregisterRunner(runnerId);
    OrchestratorLogger.log(`[HotRunner] Runner ${runnerId} recycled and removed`);
  }

  /**
   * Recycle a runner that has been idle longer than the maximum idle time.
   */
  async recycleIdleRunner(runnerId: string, maxIdleTime: number): Promise<void> {
    if (!this.registry) {
      return;
    }

    const runner = this.registry.getRunner(runnerId);
    if (!runner || runner.state !== 'idle') {
      return;
    }

    const lastCheckTime = new Date(runner.lastHealthCheck).getTime();
    const now = Date.now();
    const idleSeconds = (now - lastCheckTime) / 1000;

    if (idleSeconds >= maxIdleTime) {
      OrchestratorLogger.log(
        `[HotRunner] Runner ${runnerId} idle for ${Math.floor(idleSeconds)}s (max: ${maxIdleTime}s), recycling`,
      );
      await this.recycleUnhealthyRunner(runnerId);
    }
  }

  /**
   * Run health checks and idle-recycle checks for all registered runners.
   */
  private async runHealthChecks(): Promise<void> {
    if (!this.registry) {
      return;
    }

    const runners = this.registry.listRunners();

    for (const runner of runners) {
      if (runner.state === 'stopping') {
        continue;
      }

      const healthy = await this.checkHealth(runner.id);

      if (!healthy && runner.state !== 'starting') {
        await this.recycleUnhealthyRunner(runner.id);
        continue;
      }

      // Check for idle timeout
      const config = this.registry.getConfig(runner.id);
      if (config && runner.state === 'idle') {
        await this.recycleIdleRunner(runner.id, config.maxIdleTime);
      }

      // Check for max jobs before recycle
      if (config && config.maxJobsBeforeRecycle > 0 && runner.jobsCompleted >= config.maxJobsBeforeRecycle) {
        OrchestratorLogger.log(
          `[HotRunner] Runner ${runner.id} reached max jobs (${runner.jobsCompleted}/${config.maxJobsBeforeRecycle}), recycling`,
        );
        await this.recycleUnhealthyRunner(runner.id);
      }
    }
  }

  /**
   * Whether health monitoring is currently active.
   */
  get isMonitoring(): boolean {
    return this.intervalHandle !== undefined;
  }
}
