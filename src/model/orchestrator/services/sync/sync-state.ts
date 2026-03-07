/**
 * Persistent sync state for incremental workspace updates.
 * Stored on the runner to track what has already been synced.
 */
export interface SyncState {
  /** Last successfully synced git commit SHA */
  lastSyncCommit: string;

  /** ISO 8601 timestamp of last sync */
  lastSyncTimestamp: string;

  /** SHA-256 hash of workspace state (optional) */
  workspaceHash?: string;

  /** List of overlay paths that haven't been reverted */
  pendingOverlays: string[];
}

export type SyncStrategy = 'full' | 'git-delta' | 'direct-input' | 'storage-pull';
