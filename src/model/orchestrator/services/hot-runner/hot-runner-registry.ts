import fs from 'node:fs';
import path from 'node:path';
import { customAlphabet } from 'nanoid';
import OrchestratorLogger from '../core/orchestrator-logger';
import { HotRunnerConfig, HotRunnerStatus } from './hot-runner-types';

const generateId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 12);

const PERSISTENCE_FILENAME = 'hot-runners.json';

const VALID_RUNNER_STATES: ReadonlySet<string> = new Set(['idle', 'busy', 'starting', 'stopping', 'unhealthy']);

export interface HotRunnerFilter {
  platform?: string;
  state?: string;
  unityVersion?: string;
}

/**
 * Validate that a restored runner entry has all required fields with correct types.
 * Returns true if the entry is a valid HotRunnerStatus, false otherwise.
 */
function isValidRunnerStatus(entry: unknown): entry is HotRunnerStatus {
  if (typeof entry !== 'object' || entry === null) {
    return false;
  }

  const record = entry as Record<string, unknown>;

  return (
    typeof record.id === 'string' &&
    record.id.length > 0 &&
    typeof record.state === 'string' &&
    VALID_RUNNER_STATES.has(record.state) &&
    typeof record.unityVersion === 'string' &&
    typeof record.platform === 'string' &&
    typeof record.uptime === 'number' &&
    typeof record.jobsCompleted === 'number' &&
    typeof record.lastHealthCheck === 'string' &&
    typeof record.memoryUsageMB === 'number'
  );
}

/**
 * Validate that a restored config entry has all required fields with correct types.
 * Returns true if the entry is a valid HotRunnerConfig, false otherwise.
 */
function isValidRunnerConfig(entry: unknown): entry is HotRunnerConfig {
  if (typeof entry !== 'object' || entry === null) {
    return false;
  }

  const record = entry as Record<string, unknown>;

  return (
    typeof record.enabled === 'boolean' &&
    typeof record.transport === 'string' &&
    ['websocket', 'grpc', 'named-pipe'].includes(record.transport) &&
    typeof record.host === 'string' &&
    typeof record.port === 'number' &&
    typeof record.healthCheckInterval === 'number' &&
    typeof record.maxIdleTime === 'number' &&
    typeof record.maxJobsBeforeRecycle === 'number'
  );
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
   * Validate all runners in the registry and reset invalid ones to 'unhealthy'.
   * Returns the number of runners that were repaired.
   */
  validateAndRepair(): number {
    let repaired = 0;

    for (const [id, status] of this.runners) {
      // Cast to unknown to bypass the type guard narrowing to 'never',
      // since the Map is typed as HotRunnerStatus but entries may have
      // been corrupted via direct deserialization or unsafe casts.
      const entry = status as unknown as Record<string, unknown>;

      if (!isValidRunnerStatus(entry)) {
        OrchestratorLogger.logWarning(`[HotRunner] Runner ${id} has invalid state, marking as unhealthy`);
        this.runners.set(id, {
          id,
          state: 'unhealthy',
          unityVersion: typeof entry.unityVersion === 'string' ? entry.unityVersion : 'unknown',
          platform: typeof entry.platform === 'string' ? entry.platform : 'unknown',
          uptime: typeof entry.uptime === 'number' ? entry.uptime : 0,
          jobsCompleted: typeof entry.jobsCompleted === 'number' ? entry.jobsCompleted : 0,
          lastHealthCheck: typeof entry.lastHealthCheck === 'string' ? entry.lastHealthCheck : new Date().toISOString(),
          memoryUsageMB: typeof entry.memoryUsageMB === 'number' ? entry.memoryUsageMB : 0,
        });
        repaired++;
      }
    }

    if (repaired > 0) {
      this.persist();
    }

    return repaired;
  }

  /**
   * Persist current registry state to disk for crash recovery.
   * Validates data before writing to prevent persisting corrupt state.
   */
  private persist(): void {
    if (!this.persistencePath) {
      return;
    }

    try {
      // Validate data before persisting
      for (const [id, status] of this.runners) {
        if (!isValidRunnerStatus(status)) {
          OrchestratorLogger.logWarning(`[HotRunner] Skipping persistence -- runner ${id} has invalid state`);

          return;
        }
      }

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
   * Validates each restored entry and discards corrupt entries with warnings.
   * If the persistence file itself is corrupt (invalid JSON), starts with
   * an empty registry.
   */
  loadFromDisk(): number {
    if (!this.persistencePath || !fs.existsSync(this.persistencePath)) {
      return 0;
    }

    let data: any;

    try {
      const raw = fs.readFileSync(this.persistencePath, 'utf8');
      data = JSON.parse(raw);
    } catch (error: any) {
      OrchestratorLogger.logWarning(
        `[HotRunner] Persistence file is corrupt, starting with empty registry: ${error.message}`,
      );

      return 0;
    }

    if (typeof data !== 'object' || data === null) {
      OrchestratorLogger.logWarning('[HotRunner] Persistence file has invalid structure, starting with empty registry');

      return 0;
    }

    let discarded = 0;

    if (data.runners && typeof data.runners === 'object') {
      for (const [id, status] of Object.entries(data.runners)) {
        if (isValidRunnerStatus(status)) {
          this.runners.set(id, status);
        } else {
          OrchestratorLogger.logWarning(`[HotRunner] Discarding invalid runner entry '${id}' from persistence file`);
          discarded++;
        }
      }
    }

    if (data.configs && typeof data.configs === 'object') {
      for (const [id, config] of Object.entries(data.configs)) {
        // Only restore configs for runners that were successfully restored
        if (this.runners.has(id)) {
          if (isValidRunnerConfig(config)) {
            this.configs.set(id, config);
          } else {
            OrchestratorLogger.logWarning(`[HotRunner] Discarding invalid config entry '${id}' from persistence file`);
          }
        }
      }
    }

    if (discarded > 0) {
      OrchestratorLogger.logWarning(`[HotRunner] Discarded ${discarded} invalid runner(s) from persistence file`);
    }

    OrchestratorLogger.log(`[HotRunner] Restored ${this.runners.size} runner(s) from disk`);

    return this.runners.size;
  }
}
