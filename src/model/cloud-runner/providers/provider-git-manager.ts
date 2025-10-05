import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import path from 'path';
import CloudRunnerLogger from '../services/core/cloud-runner-logger';
import { GitHubUrlInfo, generateCacheKey } from './provider-url-parser';

const execAsync = promisify(exec);

export interface GitCloneResult {
  success: boolean;
  localPath: string;
  error?: string;
}

export interface GitUpdateResult {
  success: boolean;
  updated: boolean;
  error?: string;
}

/**
 * Manages git operations for provider repositories
 */
export class ProviderGitManager {
  private static readonly CACHE_DIR = path.join(process.cwd(), '.provider-cache');
  private static readonly GIT_TIMEOUT = 30000; // 30 seconds

  /**
   * Ensures the cache directory exists
   */
  private static ensureCacheDir(): void {
    if (!fs.existsSync(this.CACHE_DIR)) {
      fs.mkdirSync(this.CACHE_DIR, { recursive: true });
      CloudRunnerLogger.log(`Created provider cache directory: ${this.CACHE_DIR}`);
    }
  }

  /**
   * Gets the local path for a cached repository
   * @param urlInfo GitHub URL information
   * @returns Local path to the repository
   */
  private static getLocalPath(urlInfo: GitHubUrlInfo): string {
    const cacheKey = generateCacheKey(urlInfo);

    return path.join(this.CACHE_DIR, cacheKey);
  }

  /**
   * Checks if a repository is already cloned locally
   * @param urlInfo GitHub URL information
   * @returns True if repository exists locally
   */
  private static isRepositoryCloned(urlInfo: GitHubUrlInfo): boolean {
    const localPath = this.getLocalPath(urlInfo);

    return fs.existsSync(localPath) && fs.existsSync(path.join(localPath, '.git'));
  }

  /**
   * Clones a GitHub repository to the local cache
   * @param urlInfo GitHub URL information
   * @returns Clone result with success status and local path
   */
  static async cloneRepository(urlInfo: GitHubUrlInfo): Promise<GitCloneResult> {
    this.ensureCacheDir();
    const localPath = this.getLocalPath(urlInfo);

    // Remove existing directory if it exists
    if (fs.existsSync(localPath)) {
      CloudRunnerLogger.log(`Removing existing directory: ${localPath}`);
      fs.rmSync(localPath, { recursive: true, force: true });
    }

    try {
      CloudRunnerLogger.log(`Cloning repository: ${urlInfo.url} to ${localPath}`);

      const cloneCommand = `git clone --depth 1 --branch ${urlInfo.branch} ${urlInfo.url} "${localPath}"`;
      CloudRunnerLogger.log(`Executing: ${cloneCommand}`);

      const { stderr } = await execAsync(cloneCommand, {
        timeout: this.GIT_TIMEOUT,
        cwd: this.CACHE_DIR,
      });

      if (stderr && !stderr.includes('warning')) {
        CloudRunnerLogger.log(`Git clone stderr: ${stderr}`);
      }

      CloudRunnerLogger.log(`Successfully cloned repository to: ${localPath}`);

      return {
        success: true,
        localPath,
      };
    } catch (error: any) {
      const errorMessage = `Failed to clone repository ${urlInfo.url}: ${error.message}`;
      CloudRunnerLogger.log(`Error: ${errorMessage}`);

      return {
        success: false,
        localPath,
        error: errorMessage,
      };
    }
  }

  /**
   * Updates a locally cloned repository
   * @param urlInfo GitHub URL information
   * @returns Update result with success status and whether it was updated
   */
  static async updateRepository(urlInfo: GitHubUrlInfo): Promise<GitUpdateResult> {
    const localPath = this.getLocalPath(urlInfo);

    if (!this.isRepositoryCloned(urlInfo)) {
      return {
        success: false,
        updated: false,
        error: 'Repository not found locally',
      };
    }

    try {
      CloudRunnerLogger.log(`Updating repository: ${localPath}`);

      // Fetch latest changes
      await execAsync('git fetch origin', {
        timeout: this.GIT_TIMEOUT,
        cwd: localPath,
      });

      // Check if there are updates
      const { stdout: statusOutput } = await execAsync(`git status -uno`, {
        timeout: this.GIT_TIMEOUT,
        cwd: localPath,
      });

      const hasUpdates =
        statusOutput.includes('Your branch is behind') || statusOutput.includes('can be fast-forwarded');

      if (hasUpdates) {
        CloudRunnerLogger.log(`Updates available, pulling latest changes...`);

        // Reset to origin/branch to get latest changes
        await execAsync(`git reset --hard origin/${urlInfo.branch}`, {
          timeout: this.GIT_TIMEOUT,
          cwd: localPath,
        });

        CloudRunnerLogger.log(`Repository updated successfully`);

        return {
          success: true,
          updated: true,
        };
      } else {
        CloudRunnerLogger.log(`Repository is already up to date`);

        return {
          success: true,
          updated: false,
        };
      }
    } catch (error: any) {
      const errorMessage = `Failed to update repository ${localPath}: ${error.message}`;
      CloudRunnerLogger.log(`Error: ${errorMessage}`);

      return {
        success: false,
        updated: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Ensures a repository is available locally (clone if needed, update if exists)
   * @param urlInfo GitHub URL information
   * @returns Local path to the repository
   */
  static async ensureRepositoryAvailable(urlInfo: GitHubUrlInfo): Promise<string> {
    this.ensureCacheDir();

    if (this.isRepositoryCloned(urlInfo)) {
      CloudRunnerLogger.log(`Repository already exists locally, checking for updates...`);
      const updateResult = await this.updateRepository(urlInfo);

      if (!updateResult.success) {
        CloudRunnerLogger.log(`Failed to update repository, attempting fresh clone...`);
        const cloneResult = await this.cloneRepository(urlInfo);
        if (!cloneResult.success) {
          throw new Error(`Failed to ensure repository availability: ${cloneResult.error}`);
        }

        return cloneResult.localPath;
      }

      return this.getLocalPath(urlInfo);
    } else {
      CloudRunnerLogger.log(`Repository not found locally, cloning...`);
      const cloneResult = await this.cloneRepository(urlInfo);

      if (!cloneResult.success) {
        throw new Error(`Failed to clone repository: ${cloneResult.error}`);
      }

      return cloneResult.localPath;
    }
  }

  /**
   * Gets the path to the provider module within a repository
   * @param urlInfo GitHub URL information
   * @param localPath Local path to the repository
   * @returns Path to the provider module
   */
  static getProviderModulePath(urlInfo: GitHubUrlInfo, localPath: string): string {
    if (urlInfo.path) {
      return path.join(localPath, urlInfo.path);
    }

    // Look for common provider entry points
    const commonEntryPoints = [
      'index.js',
      'index.ts',
      'src/index.js',
      'src/index.ts',
      'lib/index.js',
      'lib/index.ts',
      'dist/index.js',
      'dist/index.js.map',
    ];

    for (const entryPoint of commonEntryPoints) {
      const fullPath = path.join(localPath, entryPoint);
      if (fs.existsSync(fullPath)) {
        CloudRunnerLogger.log(`Found provider entry point: ${entryPoint}`);

        return fullPath;
      }
    }

    // Default to repository root
    CloudRunnerLogger.log(`No specific entry point found, using repository root`);

    return localPath;
  }

  /**
   * Cleans up old cached repositories (optional maintenance)
   * @param maxAgeDays Maximum age in days for cached repositories
   */
  static async cleanupOldRepositories(maxAgeDays: number = 30): Promise<void> {
    this.ensureCacheDir();

    try {
      const entries = fs.readdirSync(this.CACHE_DIR, { withFileTypes: true });
      const now = Date.now();
      const maxAge = maxAgeDays * 24 * 60 * 60 * 1000; // Convert to milliseconds

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const entryPath = path.join(this.CACHE_DIR, entry.name);
          const stats = fs.statSync(entryPath);

          if (now - stats.mtime.getTime() > maxAge) {
            CloudRunnerLogger.log(`Cleaning up old repository: ${entry.name}`);
            fs.rmSync(entryPath, { recursive: true, force: true });
          }
        }
      }
    } catch (error: any) {
      CloudRunnerLogger.log(`Error during cleanup: ${error.message}`);
    }
  }
}
