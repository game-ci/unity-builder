import fs from 'node:fs';
import path from 'node:path';
import OrchestratorLogger from '../core/orchestrator-logger';
import { OrchestratorSystem } from '../core/orchestrator-system';

/**
 * Build reliability features for hardening CI pipelines.
 * All features are opt-in and fail gracefully (warnings only).
 */
export class BuildReliabilityService {
  // Windows reserved device names that cause Unity asset importer infinite loops
  private static readonly RESERVED_NAMES = new Set([
    'con',
    'prn',
    'aux',
    'nul',
    'com1',
    'com2',
    'com3',
    'com4',
    'com5',
    'com6',
    'com7',
    'com8',
    'com9',
    'lpt1',
    'lpt2',
    'lpt3',
    'lpt4',
    'lpt5',
    'lpt6',
    'lpt7',
    'lpt8',
    'lpt9',
  ]);

  // Common git lock files left by crashed processes
  private static readonly LOCK_FILE_PATTERNS = [
    'index.lock',
    'shallow.lock',
    'config.lock',
    'HEAD.lock',
    'refs/heads/*.lock',
    'refs/remotes/**/*.lock',
  ];

  /**
   * Run git fsck to check repository integrity.
   * Returns true if the repo is healthy, false if corruption detected.
   */
  static async checkGitIntegrity(repoPath: string): Promise<boolean> {
    OrchestratorLogger.log(`[Reliability] Checking git integrity in ${repoPath}`);

    try {
      await OrchestratorSystem.Run(`git -C "${repoPath}" fsck --no-dangling --no-progress`, true);
      OrchestratorLogger.log(`[Reliability] Git integrity check passed`);

      return true;
    } catch (error: any) {
      OrchestratorLogger.logWarning(`[Reliability] Git integrity check failed: ${error.message}`);

      return false;
    }
  }

  /**
   * Remove stale lock files from the .git directory.
   * Returns the number of lock files removed.
   */
  static async cleanStaleLockFiles(repoPath: string): Promise<number> {
    const gitDirectory = path.join(repoPath, '.git');
    if (!fs.existsSync(gitDirectory)) {
      return 0;
    }

    let removed = 0;

    const cleanDirectory = (directory: string): void => {
      if (!fs.existsSync(directory)) return;

      try {
        const entries = fs.readdirSync(directory, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(directory, entry.name);
          if (entry.isDirectory()) {
            cleanDirectory(fullPath);
          } else if (entry.name.endsWith('.lock')) {
            try {
              fs.unlinkSync(fullPath);
              removed++;
              OrchestratorLogger.log(`[Reliability] Removed stale lock file: ${fullPath}`);
            } catch {
              OrchestratorLogger.logWarning(`[Reliability] Could not remove lock file: ${fullPath}`);
            }
          }
        }
      } catch {
        // Directory not accessible
      }
    };

    cleanDirectory(gitDirectory);

    if (removed > 0) {
      OrchestratorLogger.log(`[Reliability] Cleaned ${removed} stale lock file(s)`);
    }

    return removed;
  }

  /**
   * Validate that submodule .git files point to existing backing stores.
   * Returns list of submodules with broken backing stores.
   */
  static async validateSubmoduleBackingStores(repoPath: string): Promise<string[]> {
    const broken: string[] = [];
    const gitmodulesPath = path.join(repoPath, '.gitmodules');

    if (!fs.existsSync(gitmodulesPath)) {
      return broken;
    }

    try {
      const content = fs.readFileSync(gitmodulesPath, 'utf8');
      const pathMatches = content.matchAll(/path\s*=\s*(.+)/g);

      for (const match of pathMatches) {
        const submodulePath = match[1].trim();
        const gitFile = path.join(repoPath, submodulePath, '.git');

        if (!fs.existsSync(gitFile)) continue;

        try {
          const stat = fs.statSync(gitFile);
          if (stat.isFile()) {
            // .git is a file -- should contain "gitdir: <path>"
            const gitFileContent = fs.readFileSync(gitFile, 'utf8').trim();
            const gitdirMatch = gitFileContent.match(/^gitdir:\s*(.+)$/);

            if (gitdirMatch) {
              const backingStore = path.resolve(path.join(repoPath, submodulePath), gitdirMatch[1]);
              if (!fs.existsSync(backingStore)) {
                broken.push(submodulePath);
                OrchestratorLogger.logWarning(
                  `[Reliability] Submodule ${submodulePath} has broken backing store: ${backingStore}`,
                );
              }
            }
          }
        } catch {
          // Can't read .git file
        }
      }
    } catch {
      // Can't read .gitmodules
    }

    if (broken.length > 0) {
      OrchestratorLogger.logWarning(`[Reliability] ${broken.length} submodule(s) have broken backing stores`);
    }

    return broken;
  }

  /**
   * Attempt to recover a corrupted repository by removing .git and re-cloning.
   * This is a last resort -- only called when git fsck fails and autoRecover is enabled.
   */
  static async recoverCorruptedRepo(repoPath: string): Promise<void> {
    OrchestratorLogger.logWarning(`[Reliability] Attempting to recover corrupted repository at ${repoPath}`);

    const gitDirectory = path.join(repoPath, '.git');
    if (fs.existsSync(gitDirectory)) {
      try {
        fs.rmSync(gitDirectory, { recursive: true, force: true });
        OrchestratorLogger.log(`[Reliability] Removed corrupted .git directory`);
      } catch (error: any) {
        OrchestratorLogger.logWarning(`[Reliability] Failed to remove .git: ${error.message}`);
      }
    }

    // Re-initialize -- the checkout action will handle the full clone
    try {
      await OrchestratorSystem.Run(`git -C "${repoPath}" init`, true);
      OrchestratorLogger.log(`[Reliability] Repository re-initialized, checkout action will complete the clone`);
    } catch (error: any) {
      OrchestratorLogger.logWarning(`[Reliability] Re-init failed: ${error.message}`);
    }
  }

  /**
   * Scan a directory tree for files/directories with Windows reserved names.
   * Returns list of paths that were cleaned up.
   */
  static async cleanReservedFilenames(projectPath: string): Promise<string[]> {
    const assetsPath = path.join(projectPath, 'Assets');
    if (!fs.existsSync(assetsPath)) {
      return [];
    }

    OrchestratorLogger.log(`[Reliability] Scanning for reserved filenames in ${assetsPath}`);
    const cleaned: string[] = [];

    const scanDirectory = (directory: string): void => {
      try {
        const entries = fs.readdirSync(directory, { withFileTypes: true });
        for (const entry of entries) {
          const nameWithoutExtension = entry.name.split('.')[0].toLowerCase();
          const fullPath = path.join(directory, entry.name);

          if (BuildReliabilityService.RESERVED_NAMES.has(nameWithoutExtension)) {
            try {
              if (entry.isDirectory()) {
                fs.rmSync(fullPath, { recursive: true, force: true });
              } else {
                fs.unlinkSync(fullPath);
              }
              cleaned.push(fullPath);
              OrchestratorLogger.logWarning(`[Reliability] Removed reserved filename: ${fullPath}`);
            } catch {
              OrchestratorLogger.logWarning(`[Reliability] Could not remove: ${fullPath}`);
            }
          } else if (entry.isDirectory()) {
            scanDirectory(fullPath);
          }
        }
      } catch {
        // Directory not accessible
      }
    };

    scanDirectory(assetsPath);

    if (cleaned.length > 0) {
      OrchestratorLogger.logWarning(`[Reliability] Cleaned ${cleaned.length} reserved filename(s)`);
    } else {
      OrchestratorLogger.log(`[Reliability] No reserved filenames found`);
    }

    return cleaned;
  }

  /**
   * Archive build output to a designated location with retention policy.
   */
  static async archiveBuildOutput(
    outputPath: string,
    archivePath: string,
    retention: number,
    platform: string,
  ): Promise<void> {
    if (!fs.existsSync(outputPath)) {
      OrchestratorLogger.log(`[Reliability] No build output to archive at ${outputPath}`);

      return;
    }

    const platformArchive = path.join(archivePath, platform);
    fs.mkdirSync(platformArchive, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[.:]/g, '-');
    const archiveDirectory = path.join(platformArchive, `build-${timestamp}`);

    try {
      fs.renameSync(outputPath, archiveDirectory);
      OrchestratorLogger.log(`[Reliability] Build output archived to ${archiveDirectory}`);
    } catch {
      // Cross-device move -- fall back to copy
      try {
        await OrchestratorSystem.Run(`cp -r "${outputPath}" "${archiveDirectory}"`, true);
        fs.rmSync(outputPath, { recursive: true, force: true });
        OrchestratorLogger.log(`[Reliability] Build output copied and archived to ${archiveDirectory}`);
      } catch (error: any) {
        OrchestratorLogger.logWarning(`[Reliability] Failed to archive build output: ${error.message}`);

        return;
      }
    }

    // Enforce retention
    await BuildReliabilityService.enforceRetention(platformArchive, retention);
  }

  /**
   * Enforce retention policy -- keep only the N most recent builds.
   * Returns the number of old builds removed.
   */
  static async enforceRetention(archivePath: string, retention: number): Promise<number> {
    if (!fs.existsSync(archivePath)) return 0;

    try {
      const entries = fs
        .readdirSync(archivePath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => ({
          name: entry.name,
          path: path.join(archivePath, entry.name),
          mtime: fs.statSync(path.join(archivePath, entry.name)).mtimeMs,
        }))
        .sort((a, b) => b.mtime - a.mtime);

      let removed = 0;
      if (entries.length > retention) {
        const toRemove = entries.slice(retention);
        for (const entry of toRemove) {
          try {
            fs.rmSync(entry.path, { recursive: true, force: true });
            removed++;
            OrchestratorLogger.log(`[Reliability] Removed old build archive: ${entry.name}`);
          } catch {
            OrchestratorLogger.logWarning(`[Reliability] Could not remove: ${entry.path}`);
          }
        }
      }

      if (removed > 0) {
        OrchestratorLogger.log(
          `[Reliability] Retention enforced: removed ${removed} old archive(s), keeping ${retention}`,
        );
      }

      return removed;
    } catch {
      return 0;
    }
  }

  /**
   * Configure environment for corrupted system git config bypass.
   */
  static configureGitEnvironment(): Record<string, string> {
    return {
      GIT_CONFIG_NOSYSTEM: '1',
    };
  }
}
