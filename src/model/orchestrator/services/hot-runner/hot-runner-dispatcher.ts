import OrchestratorLogger from '../core/orchestrator-logger';
import { HotRunnerRegistry } from './hot-runner-registry';
import { HotRunnerJobRequest, HotRunnerJobResult, HotRunnerStatus, HotRunnerTransport } from './hot-runner-types';

const POLL_INTERVAL_MS = 1000;

export type OutputCallback = (chunk: string) => void;

export class HotRunnerDispatcher {
  private transports: Map<string, HotRunnerTransport>;

  constructor(transports: Map<string, HotRunnerTransport>) {
    this.transports = transports;
  }

  /**
   * Dispatch a job to an available hot runner matching the request's build target.
   * If no runner is immediately available, waits up to the request timeout.
   * Returns the job result, or throws if no runner becomes available in time.
   */
  async dispatchJob(
    request: HotRunnerJobRequest,
    registry: HotRunnerRegistry,
    unityVersion: string,
    onOutput?: OutputCallback,
  ): Promise<HotRunnerJobResult> {
    OrchestratorLogger.log(`[HotRunner] Dispatching job ${request.jobId} (target: ${request.buildTarget})`);

    // Find or wait for an available runner
    let runner = registry.findAvailableRunner({
      unityVersion,
      platform: request.buildTarget,
    });

    if (!runner) {
      OrchestratorLogger.log(
        `[HotRunner] No idle runner available for ${unityVersion}/${request.buildTarget}, waiting...`,
      );
      runner = await this.waitForRunner({ unityVersion, platform: request.buildTarget }, request.timeout, registry);
    }

    // Mark runner as busy
    registry.updateRunner(runner.id, {
      state: 'busy',
      currentJob: request.jobId,
    });

    const transport = this.transports.get(runner.id);
    if (!transport) {
      registry.updateRunner(runner.id, { state: 'idle', currentJob: undefined });
      throw new Error(`[HotRunner] No transport available for runner ${runner.id}`);
    }

    OrchestratorLogger.log(`[HotRunner] Sending job ${request.jobId} to runner ${runner.id}`);

    const startTime = Date.now();

    try {
      const result = await this.executeWithTimeout(transport, request);

      const duration = Date.now() - startTime;
      OrchestratorLogger.log(
        `[HotRunner] Job ${request.jobId} completed on runner ${runner.id} in ${duration}ms (exit: ${result.exitCode})`,
      );

      if (onOutput && result.output) {
        onOutput(result.output);
      }

      // Mark runner as idle and increment job count
      const currentStatus = registry.getRunner(runner.id);
      registry.updateRunner(runner.id, {
        state: 'idle',
        currentJob: undefined,
        lastJobCompleted: request.jobId,
        jobsCompleted: (currentStatus?.jobsCompleted ?? 0) + 1,
      });

      return result;
    } catch (error: any) {
      OrchestratorLogger.logWarning(`[HotRunner] Job ${request.jobId} failed on runner ${runner.id}: ${error.message}`);

      // Mark runner as idle despite failure -- the health monitor will recycle if needed
      registry.updateRunner(runner.id, {
        state: 'idle',
        currentJob: undefined,
      });

      throw error;
    }
  }

  /**
   * Wait for an available runner matching the requirements.
   * Polls the registry at a fixed interval until one becomes available or timeout expires.
   */
  async waitForRunner(
    requirements: { unityVersion: string; platform: string },
    timeoutMs: number,
    registry: HotRunnerRegistry,
  ): Promise<HotRunnerStatus> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const runner = registry.findAvailableRunner(requirements);
      if (runner) {
        OrchestratorLogger.log(`[HotRunner] Runner ${runner.id} became available`);

        return runner;
      }

      await this.sleep(Math.min(POLL_INTERVAL_MS, deadline - Date.now()));
    }

    throw new Error(
      `[HotRunner] Timed out waiting for available runner (${requirements.unityVersion}/${requirements.platform}) after ${timeoutMs}ms`,
    );
  }

  /**
   * Execute a job on a transport with a timeout guard.
   */
  private async executeWithTimeout(
    transport: HotRunnerTransport,
    request: HotRunnerJobRequest,
  ): Promise<HotRunnerJobResult> {
    return new Promise<HotRunnerJobResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`[HotRunner] Job ${request.jobId} timed out after ${request.timeout}ms`));
      }, request.timeout);

      transport
        .sendJob(request)
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
