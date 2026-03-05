import OrchestratorLogger from '../core/orchestrator-logger';
import { HotRunnerRegistry } from './hot-runner-registry';
import { HotRunnerHealthMonitor } from './hot-runner-health-monitor';
import { HotRunnerDispatcher, OutputCallback } from './hot-runner-dispatcher';
import {
  HotRunnerConfig,
  HotRunnerJobRequest,
  HotRunnerJobResult,
  HotRunnerStatus,
  HotRunnerTransport,
} from './hot-runner-types';
import BuildParameters from '../../../build-parameters';

export class HotRunnerService {
  private registry: HotRunnerRegistry;
  private healthMonitor: HotRunnerHealthMonitor;
  private dispatcher: HotRunnerDispatcher;
  private transports: Map<string, HotRunnerTransport> = new Map();
  private config: HotRunnerConfig | undefined;

  constructor(persistenceDirectory?: string) {
    this.registry = new HotRunnerRegistry(persistenceDirectory);
    this.healthMonitor = new HotRunnerHealthMonitor();
    this.dispatcher = new HotRunnerDispatcher(this.transports);
  }

  /**
   * Initialize the hot runner service: load persisted state, start health monitoring.
   */
  async initialize(config: HotRunnerConfig): Promise<void> {
    this.config = config;

    OrchestratorLogger.log(
      `[HotRunner] Initializing service (transport: ${config.transport}, ${config.host}:${config.port})`,
    );

    // Attempt to restore previously registered runners from disk
    const restored = this.registry.loadFromDisk();
    if (restored > 0) {
      OrchestratorLogger.log(`[HotRunner] Restored ${restored} runner(s) from persistence`);
    }

    // Start health monitoring
    this.healthMonitor.startMonitoring(this.registry, config.healthCheckInterval, this.transports);

    OrchestratorLogger.log(`[HotRunner] Service initialized`);
  }

  /**
   * Register a runner with a transport implementation.
   * Returns the runner ID.
   */
  registerRunner(config: HotRunnerConfig, transport: HotRunnerTransport): string {
    const id = this.registry.registerRunner(config);
    this.transports.set(id, transport);

    return id;
  }

  /**
   * Submit a build job to an available hot runner.
   * Converts BuildParameters to a HotRunnerJobRequest and dispatches.
   */
  async submitBuild(params: BuildParameters, onOutput?: OutputCallback): Promise<HotRunnerJobResult> {
    const request: HotRunnerJobRequest = {
      jobId: params.buildGuid || `build-${Date.now()}`,
      buildMethod: params.buildMethod || undefined,
      buildTarget: params.targetPlatform,
      buildPath: params.buildPath,
      customParameters: params.customParameters ? this.parseCustomParameters(params.customParameters) : undefined,
      timeout: 30 * 60 * 1000, // 30 minutes default
    };

    OrchestratorLogger.log(`[HotRunner] Submitting build: ${request.jobId} (target: ${request.buildTarget})`);

    return this.dispatcher.dispatchJob(request, this.registry, params.editorVersion, onOutput);
  }

  /**
   * Submit a test job to an available hot runner.
   * Converts BuildParameters and optional suite config to a test-mode HotRunnerJobRequest.
   */
  async submitTest(
    params: BuildParameters,
    suiteConfig?: { testMode?: 'editmode' | 'playmode'; testSuitePath?: string },
    onOutput?: OutputCallback,
  ): Promise<HotRunnerJobResult> {
    const request: HotRunnerJobRequest = {
      jobId: params.buildGuid || `test-${Date.now()}`,
      buildTarget: params.targetPlatform,
      customParameters: params.customParameters ? this.parseCustomParameters(params.customParameters) : undefined,
      timeout: 30 * 60 * 1000, // 30 minutes default
      testMode: suiteConfig?.testMode ?? 'editmode',
      testSuitePath: suiteConfig?.testSuitePath,
    };

    OrchestratorLogger.log(`[HotRunner] Submitting test: ${request.jobId} (mode: ${request.testMode})`);

    return this.dispatcher.dispatchJob(request, this.registry, params.editorVersion, onOutput);
  }

  /**
   * Shut down the service: stop health monitoring, disconnect all transports,
   * and unregister all runners.
   */
  async shutdown(): Promise<void> {
    OrchestratorLogger.log(`[HotRunner] Shutting down service`);

    this.healthMonitor.stopMonitoring();

    const disconnectPromises: Promise<void>[] = [];
    for (const [id, transport] of this.transports.entries()) {
      disconnectPromises.push(
        transport.disconnect().catch((error: any) => {
          OrchestratorLogger.logWarning(`[HotRunner] Error disconnecting runner ${id}: ${error.message}`);
        }),
      );
    }
    await Promise.all(disconnectPromises);

    this.transports.clear();

    OrchestratorLogger.log(`[HotRunner] Service shut down`);
  }

  /**
   * Get the status of all registered runners.
   */
  getStatus(): HotRunnerStatus[] {
    return this.registry.listRunners();
  }

  /**
   * Get the underlying registry (for testing or advanced use).
   */
  getRegistry(): HotRunnerRegistry {
    return this.registry;
  }

  /**
   * Parse a space-separated custom parameters string into a key-value map.
   * Handles `-key value` and `-key=value` formats.
   */
  private parseCustomParameters(raw: string): Record<string, string> {
    const result: Record<string, string> = {};
    const parts = raw.trim().split(/\s+/);

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.startsWith('-')) {
        const key = part.replace(/^-+/, '');
        if (key.includes('=')) {
          const [k, ...v] = key.split('=');
          result[k] = v.join('=');
        } else if (i + 1 < parts.length && !parts[i + 1].startsWith('-')) {
          result[key] = parts[i + 1];
          i++;
        } else {
          result[key] = 'true';
        }
      }
    }

    return result;
  }
}
