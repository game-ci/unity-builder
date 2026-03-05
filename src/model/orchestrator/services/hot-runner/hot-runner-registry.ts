import fs from 'node:fs';
import path from 'node:path';
import { customAlphabet } from 'nanoid';
import OrchestratorLogger from '../core/orchestrator-logger';
import { HotRunnerConfig, HotRunnerStatus } from './hot-runner-types';

const generateId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 12);

const PERSISTENCE_FILENAME = 'hot-runners.json';

export interface HotRunnerFilter {
  platform?: string;
  state?: string;
  unityVersion?: string;
}

export class HotRunnerRegistry {
  private runners: Map<string, HotRunnerStatus> = new Map();
  private configs: Map<string, HotRunnerConfig> = new Map();
  private persistencePath: string;

  constructor(persistenceDirectory?: string) {
    this.persistencePath = persistenceDirectory ? path.join(persistenceDirectory, PERSISTENCE_FILENAME) : '';
  }

  /**
   * Register a new hot runner. Returns the generated runner ID.
   */
  registerRunner(config: HotRunnerConfig): string {
    const id = `hr-${generateId()}`;

    const status: HotRunnerStatus = {
      id,
      state: 'starting',
      unityVersion: config.unityVersion ?? 'unknown',
      platform: config.platform ?? 'unknown',
      uptime: 0,
      jobsCompleted: 0,
      lastHealthCheck: new Date().toISOString(),
      memoryUsageMB: 0,
    };

    this.runners.set(id, status);
    this.configs.set(id, config);
    OrchestratorLogger.log(`[HotRunner] Registered runner ${id} (${status.unityVersion}/${status.platform})`);

    this.persist();

    return id;
  }

  /**
   * Remove a runner from the registry.
   */
  unregisterRunner(id: string): void {
    const existed = this.runners.delete(id);
    this.configs.delete(id);

    if (existed) {
      OrchestratorLogger.log(`[HotRunner] Unregistered runner ${id}`);
      this.persist();
    }
  }

  /**
   * Get a runner's current status by ID.
   */
  getRunner(id: string): HotRunnerStatus | undefined {
    return this.runners.get(id);
  }

  /**
   * Get a runner's config by ID.
   */
  getConfig(id: string): HotRunnerConfig | undefined {
    return this.configs.get(id);
  }

  /**
   * List all runners, optionally filtered by platform, state, or Unity version.
   */
  listRunners(filter?: HotRunnerFilter): HotRunnerStatus[] {
    let results = [...this.runners.values()];

    if (filter?.platform) {
      results = results.filter((runner) => runner.platform === filter.platform);
    }

    if (filter?.state) {
      results = results.filter((runner) => runner.state === filter.state);
    }

    if (filter?.unityVersion) {
      results = results.filter((runner) => runner.unityVersion === filter.unityVersion);
    }

    return results;
  }

  /**
   * Find an idle runner matching the given Unity version and platform requirements.
   */
  findAvailableRunner(requirements: { unityVersion: string; platform: string }): HotRunnerStatus | undefined {
    return this.listRunners({
      state: 'idle',
      unityVersion: requirements.unityVersion,
      platform: requirements.platform,
    })[0];
  }

  /**
   * Update a runner's status fields. Merges partial updates into existing status.
   */
  updateRunner(id: string, update: Partial<HotRunnerStatus>): void {
    const existing = this.runners.get(id);
    if (!existing) {
      return;
    }

    this.runners.set(id, { ...existing, ...update, id });
    this.persist();
  }

  /**
   * Get the total number of registered runners.
   */
  get size(): number {
    return this.runners.size;
  }

  /**
   * Persist current registry state to disk for crash recovery.
   */
  private persist(): void {
    if (!this.persistencePath) {
      return;
    }

    try {
      const data = {
        runners: Object.fromEntries(this.runners),
        configs: Object.fromEntries(this.configs),
      };
      const directory = path.dirname(this.persistencePath);
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }
      fs.writeFileSync(this.persistencePath, JSON.stringify(data, undefined, 2));
    } catch (error: any) {
      OrchestratorLogger.logWarning(`[HotRunner] Failed to persist registry: ${error.message}`);
    }
  }

  /**
   * Load registry state from disk. Returns the number of runners restored.
   */
  loadFromDisk(): number {
    if (!this.persistencePath || !fs.existsSync(this.persistencePath)) {
      return 0;
    }

    try {
      const raw = fs.readFileSync(this.persistencePath, 'utf8');
      const data = JSON.parse(raw);

      if (data.runners) {
        for (const [id, status] of Object.entries(data.runners)) {
          this.runners.set(id, status as HotRunnerStatus);
        }
      }

      if (data.configs) {
        for (const [id, config] of Object.entries(data.configs)) {
          this.configs.set(id, config as HotRunnerConfig);
        }
      }

      OrchestratorLogger.log(`[HotRunner] Restored ${this.runners.size} runner(s) from disk`);

      return this.runners.size;
    } catch (error: any) {
      OrchestratorLogger.logWarning(`[HotRunner] Failed to load registry from disk: ${error.message}`);

      return 0;
    }
  }
}
