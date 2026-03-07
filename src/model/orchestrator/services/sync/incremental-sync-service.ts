import fs from 'node:fs';
import path from 'node:path';
import { OrchestratorSystem } from '../core/orchestrator-system';
import OrchestratorLogger from '../core/orchestrator-logger';
import { SyncState, SyncStrategy } from './sync-state';
import { SyncStateManager } from './sync-state-manager';

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
  /**
   * Load sync state from the workspace.
   */
  static loadSyncState(workspacePath: string, statePath?: string): SyncState | undefined {
    return SyncStateManager.loadState(workspacePath, statePath);
  }

  /**
   * Save sync state to the workspace.
   */
  static saveSyncState(workspacePath: string, state: SyncState, statePath?: string): void {
    SyncStateManager.saveState(workspacePath, state, statePath);
  }

  /**
   * Determine the appropriate sync strategy based on workspace state and configuration.
   */
  static resolveStrategy(requestedStrategy: SyncStrategy, workspacePath: string, statePath?: string): SyncStrategy {
    if (requestedStrategy === 'full') {
      return 'full';
    }

    // git-delta requires an existing sync state
    if (requestedStrategy === 'git-delta') {
      const state = SyncStateManager.loadState(workspacePath, statePath);
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
   * @param targetReference - Git ref to sync to (commit SHA, branch, tag)
   * @param statePath - Optional custom path for sync state file
   * @returns Number of files changed
   */
  static async syncGitDelta(workspacePath: string, targetReference: string, statePath?: string): Promise<number> {
    const state = SyncStateManager.loadState(workspacePath, statePath);
    if (!state) {
      throw new Error('Cannot git-delta sync without existing sync state');
    }

    OrchestratorLogger.log(`[Sync] Git delta: ${state.lastSyncCommit.slice(0, 8)} -> ${targetReference.slice(0, 8)}`);

    // Fetch latest
    await OrchestratorSystem.Run(`git -C "${workspacePath}" fetch origin`, true);

    // Get list of changed files
    const diffOutput = await OrchestratorSystem.Run(
      `git -C "${workspacePath}" diff --name-only ${state.lastSyncCommit}..${targetReference}`,
      true,
    );

    const changedFiles = diffOutput.split('\n').filter(Boolean);
    OrchestratorLogger.log(`[Sync] ${changedFiles.length} file(s) changed`);

    if (changedFiles.length > 0) {
      // Checkout target ref
      await OrchestratorSystem.Run(`git -C "${workspacePath}" checkout ${targetReference}`, true);
    }

    // Update sync state
    const newState: SyncState = {
      lastSyncCommit: targetReference,
      lastSyncTimestamp: new Date().toISOString(),
      workspaceHash: SyncStateManager.calculateWorkspaceHash(workspacePath),
      pendingOverlays: state.pendingOverlays,
    };
    SyncStateManager.saveState(workspacePath, newState, statePath);

    return changedFiles.length;
  }

  /**
   * Apply a direct input overlay from a local archive or storage URI.
   *
   * For storage URIs (storage://remote:bucket/path), the archive is fetched via rclone.
   * For local paths, the archive is extracted directly.
   *
   * @param workspacePath - Path to the workspace
   * @param inputReference - Local path or storage:// URI to the input archive
   * @param rcloneRemote - rclone remote name for storage:// URIs (optional, uses URI-embedded remote)
   * @param statePath - Optional custom path for sync state file
   * @returns List of overlay paths applied
   */
  static async applyDirectInput(
    workspacePath: string,
    inputReference: string,
    rcloneRemote?: string,
    statePath?: string,
  ): Promise<string[]> {
    let localArchive = inputReference;

    // If storage URI, fetch via rclone first
    if (inputReference.startsWith('storage://')) {
      const parsed = IncrementalSyncService.parseStorageUri(inputReference);
      const remote = rcloneRemote || parsed.remote;
      const remotePath = parsed.path;

      localArchive = path.join(workspacePath, '.game-ci-input-overlay.tar');
      OrchestratorLogger.log(`[Sync] Fetching input from storage: ${inputReference}`);

      await IncrementalSyncService.executeRcloneCopy(remote, remotePath, path.dirname(localArchive));
    }

    if (!fs.existsSync(localArchive)) {
      throw new Error(`Input archive not found: ${localArchive}`);
    }

    OrchestratorLogger.log(`[Sync] Applying direct input overlay from ${localArchive}`);

    // Extract overlay
    await OrchestratorSystem.Run(`tar -xf "${localArchive}" -C "${workspacePath}"`, true);

    // Track overlay in sync state
    const state = SyncStateManager.loadState(workspacePath, statePath) || {
      lastSyncCommit: '',
      lastSyncTimestamp: new Date().toISOString(),
      pendingOverlays: [],
    };

    state.pendingOverlays.push(localArchive);
    SyncStateManager.saveState(workspacePath, state, statePath);

    return [localArchive];
  }

  /**
   * Execute a storage-pull sync: pull changed files from an rclone remote.
   *
   * This strategy fetches content from a remote storage backend (S3, GCS, Azure, etc.)
   * and overlays it onto the workspace. Supports two modes:
   * - overlay: extract on top of existing workspace (default)
   * - clean: fresh git checkout, then apply overlay
   *
   * @param workspacePath - Path to the workspace
   * @param storageUri - storage://remote:bucket/path URI pointing to remote content
   * @param options - Configuration for the storage-pull operation
   * @returns List of files pulled from storage
   */
  static async syncStoragePull(
    workspacePath: string,
    storageUri: string,
    options: {
      rcloneRemote?: string;
      cleanMode?: boolean;
      syncRevertAfter?: boolean;
      statePath?: string;
    } = {},
  ): Promise<string[]> {
    if (!storageUri.startsWith('storage://')) {
      throw new Error(`Invalid storage URI: ${storageUri}. Must start with storage://`);
    }

    // Verify rclone is available
    try {
      await OrchestratorSystem.Run('rclone version', true, true);
    } catch {
      throw new Error('rclone binary not found. Install rclone to use storage-pull sync strategy.');
    }

    const parsed = IncrementalSyncService.parseStorageUri(storageUri);
    const remote = options.rcloneRemote || parsed.remote;
    const remotePath = parsed.path;

    OrchestratorLogger.log(`[Sync] Storage pull: ${remote}:${remotePath} -> ${workspacePath}`);

    // Clean mode: reset workspace to clean git state before applying overlay
    if (options.cleanMode) {
      OrchestratorLogger.log('[Sync] Clean mode: resetting workspace to HEAD');
      await OrchestratorSystem.Run(`git -C "${workspacePath}" checkout -- .`, true);
      await OrchestratorSystem.Run(`git -C "${workspacePath}" clean -fd`, true);
    }

    // Pull from remote storage directly into workspace
    const rcloneSource = `${remote}:${remotePath}`;
    await OrchestratorSystem.Run(`rclone copy "${rcloneSource}" "${workspacePath}" --transfers 8 --checkers 16`, true);

    // List what was pulled for tracking
    let pulledFiles: string[] = [];
    try {
      const lsOutput = await OrchestratorSystem.Run(`rclone ls "${rcloneSource}"`, true, true);
      pulledFiles = lsOutput
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          // rclone ls outputs: "  <size> <path>"
          const trimmed = line.trim();
          const spaceIndex = trimmed.indexOf(' ');

          return spaceIndex >= 0 ? trimmed.slice(spaceIndex + 1).trim() : trimmed;
        })
        .filter(Boolean);
    } catch {
      OrchestratorLogger.logWarning('[Sync] Could not list pulled files from remote');
    }

    OrchestratorLogger.log(`[Sync] Pulled ${pulledFiles.length} file(s) from storage`);

    // Update sync state with overlay tracking
    const state = SyncStateManager.loadState(workspacePath, options.statePath) || {
      lastSyncCommit: '',
      lastSyncTimestamp: new Date().toISOString(),
      pendingOverlays: [],
    };

    state.pendingOverlays.push(storageUri);
    state.lastSyncTimestamp = new Date().toISOString();
    state.workspaceHash = SyncStateManager.calculateWorkspaceHash(workspacePath);
    SyncStateManager.saveState(workspacePath, state, options.statePath);

    return pulledFiles;
  }

  /**
   * Parse a storage:// URI into remote and path components.
   *
   * Supported formats:
   * - storage://remote:bucket/path  (explicit remote with colon separator)
   * - storage://remote/path         (remote name is first path segment)
   *
   * @param uri - The storage:// URI to parse
   * @returns Object with remote name and path
   */
  static parseStorageUri(uri: string): { remote: string; path: string } {
    if (!uri.startsWith('storage://')) {
      throw new Error(`Invalid storage URI: ${uri}. Must start with storage://`);
    }

    const stripped = uri.replace('storage://', '');

    // Check for explicit remote:path format (e.g., "myremote:bucket/path")
    const colonIndex = stripped.indexOf(':');
    if (colonIndex > 0) {
      return {
        remote: stripped.slice(0, colonIndex),
        path: stripped.slice(colonIndex + 1),
      };
    }

    // Fallback: first segment is remote name (e.g., "myremote/bucket/path")
    const slashIndex = stripped.indexOf('/');
    if (slashIndex > 0) {
      return {
        remote: stripped.slice(0, slashIndex),
        path: stripped.slice(slashIndex + 1),
      };
    }

    // Just a remote name with no path
    return {
      remote: stripped,
      path: '',
    };
  }

  /**
   * Execute rclone copy with standard flags.
   */
  private static async executeRcloneCopy(remote: string, remotePath: string, destinationPath: string): Promise<void> {
    await OrchestratorSystem.Run(
      `rclone copy "${remote}:${remotePath}" "${destinationPath}" --transfers 8 --checkers 16`,
      true,
    );
  }

  /**
   * Revert pending overlays by restoring git state.
   */
  static async revertOverlays(workspacePath: string, statePath?: string): Promise<void> {
    const state = SyncStateManager.loadState(workspacePath, statePath);
    if (!state || state.pendingOverlays.length === 0) {
      return;
    }

    OrchestratorLogger.log(`[Sync] Reverting ${state.pendingOverlays.length} overlay(s)`);

    await OrchestratorSystem.Run(`git -C "${workspacePath}" checkout -- .`, true);

    // Clean untracked files from overlays
    await OrchestratorSystem.Run(`git -C "${workspacePath}" clean -fd`, true);

    state.pendingOverlays = [];
    state.workspaceHash = SyncStateManager.calculateWorkspaceHash(workspacePath);
    SyncStateManager.saveState(workspacePath, state, statePath);

    OrchestratorLogger.log('[Sync] Overlays reverted');
  }
}
