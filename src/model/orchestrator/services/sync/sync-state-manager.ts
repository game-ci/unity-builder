import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import OrchestratorLogger from '../core/orchestrator-logger';
import { SyncState } from './sync-state';

/**
 * Manages persistent sync state for incremental workspace updates.
 *
 * The sync state tracks what has been synced to a workspace, enabling
 * delta-based updates instead of full clones. State is stored as a JSON
 * file in the workspace (default: .game-ci/sync-state.json).
 */
export class SyncStateManager {
  static readonly DEFAULT_STATE_PATH = '.game-ci/sync-state.json';

  /**
   * Key workspace files whose content is hashed for drift detection.
   * Changes to any of these files indicate the workspace may have been
   * modified outside of the sync system.
   */
  private static readonly WORKSPACE_HASH_FILES = [
    'ProjectSettings/ProjectVersion.txt',
    'Packages/manifest.json',
    'Packages/packages-lock.json',
    'Assets/csc.rsp',
  ];

  /**
   * Load sync state from the workspace.
   *
   * @param workspacePath - Root path of the workspace
   * @param statePath - Relative path to the state file (default: .game-ci/sync-state.json)
   * @returns The loaded sync state, or undefined if no state exists or parsing fails
   */
  static loadState(workspacePath: string, statePath?: string): SyncState | undefined {
    const resolvedPath = path.join(workspacePath, statePath || SyncStateManager.DEFAULT_STATE_PATH);

    if (!fs.existsSync(resolvedPath)) {
      return;
    }

    try {
      const content = fs.readFileSync(resolvedPath, 'utf8');

      return JSON.parse(content) as SyncState;
    } catch {
      OrchestratorLogger.logWarning(`[SyncState] Failed to load sync state from ${resolvedPath}`);

      return;
    }
  }

  /**
   * Save sync state to the workspace.
   *
   * Creates parent directories if they do not exist.
   *
   * @param workspacePath - Root path of the workspace
   * @param state - The sync state to persist
   * @param statePath - Relative path to the state file (default: .game-ci/sync-state.json)
   */
  static saveState(workspacePath: string, state: SyncState, statePath?: string): void {
    const resolvedPath = path.join(workspacePath, statePath || SyncStateManager.DEFAULT_STATE_PATH);

    try {
      const directory = path.dirname(resolvedPath);
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }

      fs.writeFileSync(resolvedPath, JSON.stringify(state, undefined, 2), 'utf8');
      OrchestratorLogger.log(
        `[SyncState] State saved: commit=${state.lastSyncCommit}, overlays=${state.pendingOverlays.length}`,
      );
    } catch (error: any) {
      OrchestratorLogger.logWarning(`[SyncState] Failed to save sync state: ${error.message}`);
    }
  }

  /**
   * Calculate a SHA-256 hash of key workspace files for drift detection.
   *
   * Hashes the content of known workspace files (ProjectVersion.txt,
   * manifest.json, etc.) to produce a fingerprint. If the hash changes
   * between syncs, the workspace may have been modified externally.
   *
   * Files that do not exist are skipped (their absence is part of the hash).
   *
   * @param workspacePath - Root path of the workspace
   * @returns Hex-encoded SHA-256 hash string
   */
  static calculateWorkspaceHash(workspacePath: string): string {
    const hash = crypto.createHash('sha256');

    for (const relativePath of SyncStateManager.WORKSPACE_HASH_FILES) {
      const filePath = path.join(workspacePath, relativePath);
      try {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          hash.update(`${relativePath}:${content}`);
        } else {
          hash.update(`${relativePath}:__missing__`);
        }
      } catch {
        hash.update(`${relativePath}:__error__`);
      }
    }

    return hash.digest('hex');
  }

  /**
   * Check if the workspace has drifted from a previously saved hash.
   *
   * @param workspacePath - Root path of the workspace
   * @param savedHash - The previously saved workspace hash to compare against
   * @returns true if the current workspace hash differs from the saved hash
   */
  static hasDrifted(workspacePath: string, savedHash: string): boolean {
    const currentHash = SyncStateManager.calculateWorkspaceHash(workspacePath);

    return currentHash !== savedHash;
  }
}
