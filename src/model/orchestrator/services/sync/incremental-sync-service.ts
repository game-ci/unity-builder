import fs from 'node:fs';
import path from 'node:path';
import { OrchestratorSystem } from '../core/orchestrator-system';
import OrchestratorLogger from '../core/orchestrator-logger';
import { SyncState, SyncStrategy } from './sync-state';

/**
 * Service for incremental workspace synchronization.
 *
 * Supports multiple sync strategies:
 * - full: Traditional clone + cache restore (default)
 * - git-delta: Fetch and apply only changed files since last sync
 * - direct-input: Apply file changes passed as job input (no git push required)
 * - storage-pull: Fetch changed files from rclone-backed generic storage
 */
export class IncrementalSyncService {
  private static readonly SYNC_STATE_FILE = '.game-ci-sync-state.json';

  /**
   * Load sync state from the workspace.
   */
  static loadSyncState(workspacePath: string): SyncState | null {
    const statePath = path.join(workspacePath, IncrementalSyncService.SYNC_STATE_FILE);
    if (!fs.existsSync(statePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(statePath, 'utf8');

      return JSON.parse(content) as SyncState;
    } catch {
      OrchestratorLogger.logWarning(`[Sync] Failed to load sync state from ${statePath}`);

      return null;
    }
  }

  /**
   * Save sync state to the workspace.
   */
  static saveSyncState(workspacePath: string, state: SyncState): void {
    const statePath = path.join(workspacePath, IncrementalSyncService.SYNC_STATE_FILE);
    try {
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
      OrchestratorLogger.log(`[Sync] State saved: commit=${state.lastSyncCommit}`);
    } catch (error: any) {
      OrchestratorLogger.logWarning(`[Sync] Failed to save sync state: ${error.message}`);
    }
  }

  /**
   * Determine the appropriate sync strategy based on workspace state and configuration.
   */
  static resolveStrategy(
    requestedStrategy: SyncStrategy,
    workspacePath: string,
  ): SyncStrategy {
    if (requestedStrategy === 'full') {
      return 'full';
    }

    // git-delta requires an existing sync state
    if (requestedStrategy === 'git-delta') {
      const state = IncrementalSyncService.loadSyncState(workspacePath);
      if (!state) {
        OrchestratorLogger.log('[Sync] No sync state found, falling back to full sync');

        return 'full';
      }

      return 'git-delta';
    }

    return requestedStrategy;
  }

  /**
   * Execute a git-delta sync: fetch latest and apply only changed files.
   *
   * @param workspacePath - Path to the git workspace
   * @param targetRef - Git ref to sync to (commit SHA, branch, tag)
   * @returns Number of files changed
   */
  static async syncGitDelta(workspacePath: string, targetRef: string): Promise<number> {
    const state = IncrementalSyncService.loadSyncState(workspacePath);
    if (!state) {
      throw new Error('Cannot git-delta sync without existing sync state');
    }

    OrchestratorLogger.log(`[Sync] Git delta: ${state.lastSyncCommit.slice(0, 8)} → ${targetRef.slice(0, 8)}`);

    // Fetch latest
    await OrchestratorSystem.Run(`git -C "${workspacePath}" fetch origin`, true);

    // Get list of changed files
    const diffOutput = await OrchestratorSystem.Run(
      `git -C "${workspacePath}" diff --name-only ${state.lastSyncCommit}..${targetRef}`,
      true,
    );

    const changedFiles = diffOutput.split('\n').filter(Boolean);
    OrchestratorLogger.log(`[Sync] ${changedFiles.length} file(s) changed`);

    if (changedFiles.length > 0) {
      // Checkout target ref
      await OrchestratorSystem.Run(`git -C "${workspacePath}" checkout ${targetRef}`, true);
    }

    // Update sync state
    const newState: SyncState = {
      lastSyncCommit: targetRef,
      lastSyncTimestamp: new Date().toISOString(),
      pendingOverlays: state.pendingOverlays,
    };
    IncrementalSyncService.saveSyncState(workspacePath, newState);

    return changedFiles.length;
  }

  /**
   * Apply a direct input overlay from a local archive or storage URI.
   *
   * For storage URIs (storage://remote/path), the archive is fetched via rclone.
   * For local paths, the archive is extracted directly.
   *
   * @param workspacePath - Path to the workspace
   * @param inputRef - Local path or storage:// URI to the input archive
   * @param rcloneRemote - rclone remote name for storage:// URIs (optional, uses default)
   * @returns List of overlay paths applied
   */
  static async applyDirectInput(
    workspacePath: string,
    inputRef: string,
    rcloneRemote?: string,
  ): Promise<string[]> {
    let localArchive = inputRef;

    // If storage URI, fetch via rclone first
    if (inputRef.startsWith('storage://')) {
      const storagePath = inputRef.replace('storage://', '');
      const remote = rcloneRemote || storagePath.split('/')[0];
      const remotePath = storagePath.includes('/') ? storagePath.slice(storagePath.indexOf('/') + 1) : storagePath;

      localArchive = path.join(workspacePath, '.game-ci-input-overlay.tar');
      OrchestratorLogger.log(`[Sync] Fetching input from storage: ${inputRef}`);

      await OrchestratorSystem.Run(
        `rclone copy "${remote}:${remotePath}" "${path.dirname(localArchive)}" --include "${path.basename(localArchive)}"`,
        true,
      );
    }

    if (!fs.existsSync(localArchive)) {
      throw new Error(`Input archive not found: ${localArchive}`);
    }

    OrchestratorLogger.log(`[Sync] Applying direct input overlay from ${localArchive}`);

    // Extract overlay
    await OrchestratorSystem.Run(
      `tar -xf "${localArchive}" -C "${workspacePath}"`,
      true,
    );

    // Track overlay in sync state
    const state = IncrementalSyncService.loadSyncState(workspacePath) || {
      lastSyncCommit: '',
      lastSyncTimestamp: new Date().toISOString(),
      pendingOverlays: [],
    };

    state.pendingOverlays.push(localArchive);
    IncrementalSyncService.saveSyncState(workspacePath, state);

    return [localArchive];
  }

  /**
   * Revert pending overlays by restoring git state.
   */
  static async revertOverlays(workspacePath: string): Promise<void> {
    const state = IncrementalSyncService.loadSyncState(workspacePath);
    if (!state || state.pendingOverlays.length === 0) {
      return;
    }

    OrchestratorLogger.log(`[Sync] Reverting ${state.pendingOverlays.length} overlay(s)`);

    await OrchestratorSystem.Run(
      `git -C "${workspacePath}" checkout -- .`,
      true,
    );

    // Clean untracked files from overlays
    await OrchestratorSystem.Run(
      `git -C "${workspacePath}" clean -fd`,
      true,
    );

    state.pendingOverlays = [];
    IncrementalSyncService.saveSyncState(workspacePath, state);

    OrchestratorLogger.log('[Sync] Overlays reverted');
  }
}
