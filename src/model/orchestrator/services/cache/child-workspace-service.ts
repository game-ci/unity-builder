import fs from 'node:fs';
import path from 'node:path';
import OrchestratorLogger from '../core/orchestrator-logger';

export interface ChildWorkspaceConfig {
  enabled: boolean;

  /** Name for this child workspace, used as cache key (e.g., "TurnOfWar", "Shell") */
  workspaceName: string;

  /** Parent directory for cached child workspaces. Should be on same NTFS volume for O(1) restore. */
  parentCacheRoot: string;

  /** Keep .git directory in cached workspace for delta operations (default: true) */
  preserveGitDirectory: boolean;

  /** Cache Library/ independently from workspace (default: true) */
  separateLibraryCache: boolean;

  /** Override location for Library cache. Defaults to parentCacheRoot/<workspaceName>/Library-cache */
  libraryBackupPath?: string;
}

/**
 * Child workspace isolation service for enterprise-scale CI builds.
 *
 * Instead of building in the git checkout directory, this service:
 * 1. Keeps the root workspace lean (no LFS files in the checkout dir)
 * 2. Creates isolated child workspaces per product/build-target
 * 3. Each child workspace gets its own submodule profile, LFS hydration, and Library folder
 * 4. After build, the child workspace (.git preserved) is moved to a parent-level backup directory
 * 5. On next CI run, the child workspace is restored via atomic filesystem move (O(1) on NTFS)
 * 6. Library folders are cached separately for independent restore
 *
 * This is orders of magnitude faster than actions/cache for 50GB+ workspaces.
 */
export class ChildWorkspaceService {
  /**
   * Initialize child workspace by restoring from cache if available.
   * Uses atomic filesystem move (rename) for O(1) restore on same volume.
   *
   * @param projectPath - Target path where the workspace should live during build
   * @param config - Child workspace configuration
   * @returns true if restored from cache, false if starting fresh
   */
  static initializeWorkspace(projectPath: string, config: ChildWorkspaceConfig): boolean {
    const cachedWorkspacePath = path.join(config.parentCacheRoot, config.workspaceName);

    try {
      if (!fs.existsSync(cachedWorkspacePath)) {
        OrchestratorLogger.log(`[ChildWorkspace] No cached workspace found at ${cachedWorkspacePath}, starting fresh`);

        return false;
      }

      // Verify the cached workspace has content
      const entries = fs.readdirSync(cachedWorkspacePath);
      if (entries.length === 0) {
        OrchestratorLogger.log(`[ChildWorkspace] Cached workspace at ${cachedWorkspacePath} is empty, starting fresh`);
        fs.rmSync(cachedWorkspacePath, { recursive: true, force: true });

        return false;
      }

      // If the target path already exists, remove it to make way for the move
      if (fs.existsSync(projectPath)) {
        OrchestratorLogger.log(`[ChildWorkspace] Removing existing target path: ${projectPath}`);
        fs.rmSync(projectPath, { recursive: true, force: true });
      }

      // Ensure parent directory of project path exists
      const parentDirectory = path.dirname(projectPath);
      if (!fs.existsSync(parentDirectory)) {
        fs.mkdirSync(parentDirectory, { recursive: true });
      }

      // Atomic move (rename) - O(1) on NTFS when on same volume
      OrchestratorLogger.log(`[ChildWorkspace] Restoring workspace: ${cachedWorkspacePath} -> ${projectPath}`);
      fs.renameSync(cachedWorkspacePath, projectPath);
      OrchestratorLogger.log(`[ChildWorkspace] Workspace restored via atomic move`);

      // Restore Library cache separately if configured
      if (config.separateLibraryCache) {
        ChildWorkspaceService.restoreLibraryCache(projectPath, config);
      }

      return true;
    } catch (error: any) {
      OrchestratorLogger.logWarning(`[ChildWorkspace] Workspace restore failed: ${error.message}. Starting fresh.`);

      return false;
    }
  }

  /**
   * Save child workspace after build for reuse on next CI run.
   * Moves the entire workspace to the cache directory via atomic filesystem move.
   *
   * @param projectPath - Path to the workspace to save
   * @param config - Child workspace configuration
   */
  static saveWorkspace(projectPath: string, config: ChildWorkspaceConfig): void {
    const cachedWorkspacePath = path.join(config.parentCacheRoot, config.workspaceName);

    try {
      if (!fs.existsSync(projectPath)) {
        OrchestratorLogger.log(`[ChildWorkspace] Project path ${projectPath} does not exist, skipping save`);

        return;
      }

      // Remove .git directory if not preserving it (saves space but loses delta capability)
      if (!config.preserveGitDirectory) {
        const gitDirectory = path.join(projectPath, '.git');
        if (fs.existsSync(gitDirectory)) {
          OrchestratorLogger.log(`[ChildWorkspace] Removing .git directory (preserveGit=false)`);
          fs.rmSync(gitDirectory, { recursive: true, force: true });
        }
      }

      // If separateLibraryCache, move Library/ to its own backup path before saving workspace
      if (config.separateLibraryCache) {
        ChildWorkspaceService.saveLibraryCache(projectPath, config);
      }

      // Ensure parent cache root exists
      if (!fs.existsSync(config.parentCacheRoot)) {
        fs.mkdirSync(config.parentCacheRoot, { recursive: true });
      }

      // Remove any existing cached workspace to make room
      if (fs.existsSync(cachedWorkspacePath)) {
        OrchestratorLogger.log(`[ChildWorkspace] Removing previous cached workspace: ${cachedWorkspacePath}`);
        fs.rmSync(cachedWorkspacePath, { recursive: true, force: true });
      }

      // Atomic move (rename) - O(1) on NTFS when on same volume
      OrchestratorLogger.log(`[ChildWorkspace] Saving workspace: ${projectPath} -> ${cachedWorkspacePath}`);
      fs.renameSync(projectPath, cachedWorkspacePath);
      OrchestratorLogger.log(`[ChildWorkspace] Workspace saved via atomic move`);
    } catch (error: any) {
      OrchestratorLogger.logWarning(`[ChildWorkspace] Workspace save failed: ${error.message}`);
    }
  }

  /**
   * Restore Library folder from separate cache location.
   *
   * @param projectPath - Path to the workspace where Library should be restored
   * @param config - Child workspace configuration
   * @returns true if Library was restored from cache
   */
  static restoreLibraryCache(projectPath: string, config: ChildWorkspaceConfig): boolean {
    const libraryBackup = ChildWorkspaceService.resolveLibraryBackupPath(config);
    const libraryDestination = path.join(projectPath, 'Library');

    try {
      if (!fs.existsSync(libraryBackup)) {
        OrchestratorLogger.log(`[ChildWorkspace] No Library cache found at ${libraryBackup}`);

        return false;
      }

      const entries = fs.readdirSync(libraryBackup);
      if (entries.length === 0) {
        OrchestratorLogger.log(`[ChildWorkspace] Library cache at ${libraryBackup} is empty`);
        fs.rmSync(libraryBackup, { recursive: true, force: true });

        return false;
      }

      // Remove existing Library directory if present
      if (fs.existsSync(libraryDestination)) {
        fs.rmSync(libraryDestination, { recursive: true, force: true });
      }

      // Atomic move
      OrchestratorLogger.log(`[ChildWorkspace] Restoring Library cache: ${libraryBackup} -> ${libraryDestination}`);
      fs.renameSync(libraryBackup, libraryDestination);
      OrchestratorLogger.log(`[ChildWorkspace] Library cache restored`);

      return true;
    } catch (error: any) {
      OrchestratorLogger.logWarning(`[ChildWorkspace] Library cache restore failed: ${error.message}`);

      return false;
    }
  }

  /**
   * Save Library folder to a separate cache location for independent restore.
   * Moves Library/ out of the workspace before workspace save.
   *
   * @param projectPath - Path to the workspace containing Library/
   * @param config - Child workspace configuration
   */
  private static saveLibraryCache(projectPath: string, config: ChildWorkspaceConfig): void {
    const libraryPath = path.join(projectPath, 'Library');
    const libraryBackup = ChildWorkspaceService.resolveLibraryBackupPath(config);

    try {
      if (!fs.existsSync(libraryPath)) {
        OrchestratorLogger.log(`[ChildWorkspace] No Library folder to cache`);

        return;
      }

      const entries = fs.readdirSync(libraryPath);
      if (entries.length === 0) {
        OrchestratorLogger.log(`[ChildWorkspace] Library folder is empty, skipping cache`);

        return;
      }

      // Ensure parent of backup path exists
      const backupParent = path.dirname(libraryBackup);
      if (!fs.existsSync(backupParent)) {
        fs.mkdirSync(backupParent, { recursive: true });
      }

      // Remove existing Library backup
      if (fs.existsSync(libraryBackup)) {
        fs.rmSync(libraryBackup, { recursive: true, force: true });
      }

      // Atomic move
      OrchestratorLogger.log(`[ChildWorkspace] Caching Library: ${libraryPath} -> ${libraryBackup}`);
      fs.renameSync(libraryPath, libraryBackup);
      OrchestratorLogger.log(`[ChildWorkspace] Library cached separately`);
    } catch (error: any) {
      OrchestratorLogger.logWarning(`[ChildWorkspace] Library cache save failed: ${error.message}`);
    }
  }

  /**
   * Calculate the total size of a directory in human-readable format.
   *
   * @param directoryPath - Path to the directory to measure
   * @returns Human-readable size string (e.g., "1.23 GB", "456.78 MB")
   */
  static getWorkspaceSize(directoryPath: string): string {
    try {
      if (!fs.existsSync(directoryPath)) {
        return '0 B';
      }

      const totalBytes = ChildWorkspaceService.calculateDirectorySize(directoryPath);

      return ChildWorkspaceService.formatBytes(totalBytes);
    } catch (error: any) {
      OrchestratorLogger.logWarning(`[ChildWorkspace] Failed to calculate workspace size: ${error.message}`);

      return 'unknown';
    }
  }

  /**
   * Clean stale child workspaces that haven't been used within the retention period.
   *
   * @param parentCacheRoot - Root directory containing cached workspaces
   * @param retentionDays - Maximum age in days before a workspace is considered stale
   */
  static cleanStaleWorkspaces(parentCacheRoot: string, retentionDays: number): void {
    try {
      if (!fs.existsSync(parentCacheRoot)) {
        OrchestratorLogger.log(`[ChildWorkspace] Cache root ${parentCacheRoot} does not exist, nothing to clean`);

        return;
      }

      const now = Date.now();
      const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
      const entries = fs.readdirSync(parentCacheRoot);
      let removedCount = 0;
      let freedBytes = 0;

      for (const entry of entries) {
        const entryPath = path.join(parentCacheRoot, entry);
        try {
          const stat = fs.statSync(entryPath);
          if (stat.isDirectory() && now - stat.mtimeMs > maxAgeMs) {
            const size = ChildWorkspaceService.calculateDirectorySize(entryPath);
            fs.rmSync(entryPath, { recursive: true, force: true });
            removedCount++;
            freedBytes += size;
            OrchestratorLogger.log(
              `[ChildWorkspace] Cleaned stale workspace: ${entry} (age: ${Math.floor(
                (now - stat.mtimeMs) / (24 * 60 * 60 * 1000),
              )} days)`,
            );
          }
        } catch (error: any) {
          OrchestratorLogger.logWarning(`[ChildWorkspace] Failed to clean ${entryPath}: ${error.message}`);
        }
      }

      OrchestratorLogger.log(
        `[ChildWorkspace] Cleanup complete: ${removedCount} stale workspaces removed, ${ChildWorkspaceService.formatBytes(
          freedBytes,
        )} freed`,
      );
    } catch (error: any) {
      OrchestratorLogger.logWarning(`[ChildWorkspace] Stale workspace cleanup failed: ${error.message}`);
    }
  }

  /**
   * Build a ChildWorkspaceConfig from build parameters and action inputs.
   */
  static buildConfig(parameters: {
    childWorkspacesEnabled: boolean;
    childWorkspaceName: string;
    childWorkspaceCacheRoot: string;
    childWorkspacePreserveGit: boolean;
    childWorkspaceSeparateLibrary: boolean;
  }): ChildWorkspaceConfig {
    return {
      enabled: parameters.childWorkspacesEnabled,
      workspaceName: parameters.childWorkspaceName,
      parentCacheRoot: parameters.childWorkspaceCacheRoot,
      preserveGitDirectory: parameters.childWorkspacePreserveGit,
      separateLibraryCache: parameters.childWorkspaceSeparateLibrary,
    };
  }

  /**
   * Resolve the Library backup path from config, using a default if not overridden.
   */
  private static resolveLibraryBackupPath(config: ChildWorkspaceConfig): string {
    if (config.libraryBackupPath) {
      return config.libraryBackupPath;
    }

    return path.join(config.parentCacheRoot, `${config.workspaceName}-Library`);
  }

  /**
   * Recursively calculate total size of a directory in bytes.
   */
  private static calculateDirectorySize(directoryPath: string): number {
    let totalSize = 0;

    try {
      const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(directoryPath, entry.name);
        if (entry.isDirectory()) {
          totalSize += ChildWorkspaceService.calculateDirectorySize(fullPath);
        } else if (entry.isFile()) {
          totalSize += fs.statSync(fullPath).size;
        }
      }
    } catch {
      // Permission errors or race conditions — return what we have
    }

    return totalSize;
  }

  /**
   * Format bytes into human-readable string.
   */
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const index = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, index);

    return `${value.toFixed(2)} ${units[index]}`;
  }
}
