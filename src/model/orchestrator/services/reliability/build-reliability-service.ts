import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import * as core from '@actions/core';

/**
 * Build reliability features for hardening CI pipelines.
 * Provides git integrity checks, stale lock cleanup, submodule validation,
 * reserved filename removal, build archival, and git environment configuration.
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

  // Lock files to look for in the .git directory
  private static readonly LOCK_FILE_NAMES = new Set(['index.lock', 'shallow.lock', 'config.lock', 'HEAD.lock']);

  // Maximum age in milliseconds before a lock file is considered stale (10 minutes)
  private static readonly LOCK_FILE_MAX_AGE_MS = 10 * 60 * 1000;

  /**
   * Run git fsck to check repository integrity.
   * Returns true if the repo is healthy, false if corruption detected.
   */
  static checkGitIntegrity(repoPath: string = '.'): boolean {
    core.info(`[Reliability] Checking git integrity in ${repoPath}`);

    try {
      const output = execSync(`git -C "${repoPath}" fsck --no-dangling`, {
        encoding: 'utf8',
        timeout: 120_000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Parse output for corruption indicators
      const corruptionPatterns = [
        /broken link/i,
        /missing (blob|tree|commit|tag)/i,
        /dangling/i,
        /corrupt/i,
        /error in /i,
      ];

      for (const pattern of corruptionPatterns) {
        if (pattern.test(output)) {
          core.warning(`[Reliability] Git integrity check found issues: ${output.trim()}`);
          return false;
        }
      }

      core.info('[Reliability] Git integrity check passed');
      return true;
    } catch (error: any) {
      // execSync throws on non-zero exit code
      const stderr = error.stderr?.toString() ?? error.message;
      core.warning(`[Reliability] Git integrity check failed: ${stderr}`);
      return false;
    }
  }

  /**
   * Remove stale .lock files from the .git directory.
   * Only removes lock files older than 10 minutes to avoid interfering with active operations.
   * Returns the number of lock files removed.
   */
  static cleanStaleLockFiles(repoPath: string = '.'): number {
    const gitDir = path.join(repoPath, '.git');
    if (!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()) {
      return 0;
    }

    core.info(`[Reliability] Scanning for stale lock files in ${gitDir}`);
    const now = Date.now();
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
            // Check if it is a known lock file location OR under refs/
            const relativePath = path.relative(gitDir, fullPath);
            const isKnownLock = BuildReliabilityService.LOCK_FILE_NAMES.has(entry.name);
            const isRefsLock = relativePath.startsWith('refs' + path.sep);

            if (isKnownLock || isRefsLock) {
              try {
                const stat = fs.statSync(fullPath);
                const ageMs = now - stat.mtimeMs;

                if (ageMs > BuildReliabilityService.LOCK_FILE_MAX_AGE_MS) {
                  fs.unlinkSync(fullPath);
                  removed++;
                  core.info(
                    `[Reliability] Removed stale lock file (age: ${Math.round(ageMs / 1000)}s): ${relativePath}`,
                  );
                } else {
                  core.info(
                    `[Reliability] Lock file is recent (age: ${Math.round(ageMs / 1000)}s), skipping: ${relativePath}`,
                  );
                }
              } catch {
                core.warning(`[Reliability] Could not remove lock file: ${fullPath}`);
              }
            }
          }
        }
      } catch {
        // Directory not accessible
      }
    };

    cleanDirectory(gitDir);

    if (removed > 0) {
      core.info(`[Reliability] Cleaned ${removed} stale lock file(s)`);
    } else {
      core.info('[Reliability] No stale lock files found');
    }

    return removed;
  }

  /**
   * Validate that submodule .git files point to existing backing stores
   * under .git/modules/. Returns list of submodule paths with broken backing stores.
   */
  static validateSubmoduleBackingStores(repoPath: string = '.'): string[] {
    const broken: string[] = [];
    const gitmodulesPath = path.join(repoPath, '.gitmodules');

    if (!fs.existsSync(gitmodulesPath)) {
      core.info('[Reliability] No .gitmodules found, skipping submodule validation');
      return broken;
    }

    core.info(`[Reliability] Validating submodule backing stores in ${repoPath}`);

    try {
      const content = fs.readFileSync(gitmodulesPath, 'utf8');
      const pathMatches = content.matchAll(/path\s*=\s*(.+)/g);

      for (const match of pathMatches) {
        const submodulePath = match[1].trim();
        const gitFile = path.join(repoPath, submodulePath, '.git');

        if (!fs.existsSync(gitFile)) {
          // Submodule not initialized -- not necessarily broken
          continue;
        }

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
                core.warning(`[Reliability] Submodule ${submodulePath} has broken backing store: ${backingStore}`);
              } else {
                core.info(`[Reliability] Submodule ${submodulePath} backing store OK`);
              }
            } else {
              broken.push(submodulePath);
              core.warning(`[Reliability] Submodule ${submodulePath} .git file has invalid format`);
            }
          }
        } catch {
          // Can't read .git file
          core.warning(`[Reliability] Could not read .git file for submodule: ${submodulePath}`);
        }
      }
    } catch (error: any) {
      core.warning(`[Reliability] Could not read .gitmodules: ${error.message}`);
    }

    if (broken.length > 0) {
      core.warning(`[Reliability] ${broken.length} submodule(s) have broken backing stores`);
    } else {
      core.info('[Reliability] All submodule backing stores are valid');
    }

    return broken;
  }

  /**
   * Orchestrate recovery of a corrupted repository.
   * Sequence: fsck -> clean locks -> re-fetch -> retry fsck.
   * Returns true if recovery succeeded.
   */
  static recoverCorruptedRepo(repoPath: string = '.'): boolean {
    core.warning(`[Reliability] Attempting automatic recovery for ${repoPath}`);

    // Step 1: Clean stale lock files that may be preventing operations
    const locksRemoved = BuildReliabilityService.cleanStaleLockFiles(repoPath);
    if (locksRemoved > 0) {
      core.info(`[Reliability] Recovery: cleaned ${locksRemoved} lock file(s)`);
    }

    // Step 2: Re-fetch to restore missing objects
    try {
      core.info('[Reliability] Recovery: re-fetching from remote');
      execSync(`git -C "${repoPath}" fetch --all`, {
        encoding: 'utf8',
        timeout: 300_000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      core.info('[Reliability] Recovery: fetch completed');
    } catch (error: any) {
      core.warning(`[Reliability] Recovery: fetch failed: ${error.stderr?.toString() ?? error.message}`);
    }

    // Step 3: Retry fsck
    const healthy = BuildReliabilityService.checkGitIntegrity(repoPath);
    if (healthy) {
      core.info('[Reliability] Recovery succeeded -- repository is healthy');
    } else {
      core.warning('[Reliability] Recovery failed -- repository still has integrity issues');
    }

    return healthy;
  }

  /**
   * Scan a directory tree for files/directories with Windows reserved names.
   * These names (con, prn, aux, nul, com1-9, lpt1-9) with any extension
   * cause Unity asset importer infinite loops on Windows.
   * Returns list of paths that were removed.
   */
  static cleanReservedFilenames(projectPath: string): string[] {
    const assetsPath = path.join(projectPath, 'Assets');
    if (!fs.existsSync(assetsPath)) {
      core.info(`[Reliability] No Assets directory found at ${assetsPath}, skipping reserved filename scan`);
      return [];
    }

    core.info(`[Reliability] Scanning for reserved filenames in ${assetsPath}`);
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
              core.warning(`[Reliability] Removed reserved filename: ${fullPath}`);
            } catch {
              core.warning(`[Reliability] Could not remove reserved filename: ${fullPath}`);
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
      core.warning(`[Reliability] Cleaned ${cleaned.length} reserved filename(s)`);
    } else {
      core.info('[Reliability] No reserved filenames found');
    }

    return cleaned;
  }

  /**
   * Create a tar.gz archive of build output.
   */
  static archiveBuildOutput(sourcePath: string, archivePath: string): void {
    if (!fs.existsSync(sourcePath)) {
      core.info(`[Reliability] No build output to archive at ${sourcePath}`);
      return;
    }

    fs.mkdirSync(archivePath, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[.:]/g, '-');
    const archiveFile = path.join(archivePath, `build-${timestamp}.tar.gz`);

    try {
      execSync(`tar -czf "${archiveFile}" -C "${path.dirname(sourcePath)}" "${path.basename(sourcePath)}"`, {
        encoding: 'utf8',
        timeout: 600_000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      core.info(`[Reliability] Build output archived to ${archiveFile}`);
    } catch (error: any) {
      core.warning(`[Reliability] Failed to archive build output: ${error.stderr?.toString() ?? error.message}`);
    }
  }

  /**
   * Enforce retention policy -- delete archives older than the retention period.
   * Returns the number of old archives removed.
   */
  static enforceRetention(archivePath: string, retentionDays: number): number {
    if (!fs.existsSync(archivePath)) {
      return 0;
    }

    const now = Date.now();
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
    let removed = 0;

    try {
      const entries = fs.readdirSync(archivePath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(archivePath, entry.name);
        try {
          const stat = fs.statSync(fullPath);
          const ageMs = now - stat.mtimeMs;

          if (ageMs > retentionMs) {
            if (entry.isDirectory()) {
              fs.rmSync(fullPath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(fullPath);
            }
            removed++;
            core.info(
              `[Reliability] Removed old archive: ${entry.name} (age: ${Math.round(
                ageMs / (24 * 60 * 60 * 1000),
              )} days)`,
            );
          }
        } catch {
          core.warning(`[Reliability] Could not process archive entry: ${fullPath}`);
        }
      }
    } catch {
      core.warning(`[Reliability] Could not read archive directory: ${archivePath}`);
      return 0;
    }

    if (removed > 0) {
      core.info(
        `[Reliability] Retention enforced: removed ${removed} old archive(s), retention: ${retentionDays} days`,
      );
    }

    return removed;
  }

  /**
   * Configure git environment variables for CI reliability.
   * Sets GIT_TERMINAL_PROMPT=0, increases http.postBuffer, enables core.longpaths.
   */
  static configureGitEnvironment(): void {
    core.info('[Reliability] Configuring git environment for CI');

    // Prevent git from prompting for credentials (hangs in CI)
    process.env.GIT_TERMINAL_PROMPT = '0';
    core.info('[Reliability] Set GIT_TERMINAL_PROMPT=0');

    try {
      // Increase http.postBuffer to 500MB for large pushes
      execSync('git config --global http.postBuffer 524288000', {
        encoding: 'utf8',
        timeout: 10_000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      core.info('[Reliability] Set http.postBuffer=524288000 (500MB)');
    } catch (error: any) {
      core.warning(`[Reliability] Could not set http.postBuffer: ${error.message}`);
    }

    try {
      // Enable long paths on Windows
      execSync('git config --global core.longpaths true', {
        encoding: 'utf8',
        timeout: 10_000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      core.info('[Reliability] Set core.longpaths=true');
    } catch (error: any) {
      core.warning(`[Reliability] Could not set core.longpaths: ${error.message}`);
    }
  }
}
