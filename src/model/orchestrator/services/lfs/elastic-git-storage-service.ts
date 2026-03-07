import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { OrchestratorSystem } from '../core/orchestrator-system';
import OrchestratorLogger from '../core/orchestrator-logger';
import { LfsAgentService } from './lfs-agent-service';

/**
 * Built-in support for elastic-git-storage, a custom Git LFS transfer agent
 * that supports multiple storage backends (local filesystem, WebDAV, rclone remotes).
 *
 * When `lfsTransferAgent` is set to 'elastic-git-storage', this service:
 * 1. Checks if the agent is already installed on the system
 * 2. If not, downloads it from the GitHub release page
 * 3. Makes it executable
 * 4. Delegates to LfsAgentService for git config setup
 *
 * @see https://github.com/frostebite/elastic-git-storage
 */
export class ElasticGitStorageService {
  static readonly REPO_OWNER = 'frostebite';
  static readonly REPO_NAME = 'elastic-git-storage';
  static readonly AGENT_NAME = 'elastic-git-storage';

  /**
   * Parse an agent value that may include a version suffix.
   * Supports formats like:
   *   - 'elastic-git-storage' → { name: 'elastic-git-storage', version: 'latest' }
   *   - 'elastic-git-storage@v1.0.0' → { name: 'elastic-git-storage', version: 'v1.0.0' }
   *   - 'elastic-git-storage@latest' → { name: 'elastic-git-storage', version: 'latest' }
   */
  static parseAgentValue(agentValue: string): { name: string; version: string } {
    const trimmed = agentValue.trim();
    const atIndex = trimmed.indexOf('@');
    if (atIndex > 0) {
      return {
        name: trimmed.substring(0, atIndex),
        version: trimmed.substring(atIndex + 1) || 'latest',
      };
    }

    return { name: trimmed, version: 'latest' };
  }

  /**
   * Check if the given lfsTransferAgent value refers to elastic-git-storage.
   * Matches the exact name (without path) or a path ending in the agent name.
   * Also matches 'elastic-git-storage@version' format.
   */
  static isElasticGitStorage(agentValue: string): boolean {
    if (!agentValue) return false;

    const { name } = ElasticGitStorageService.parseAgentValue(agentValue);
    const normalized = name.trim().toLowerCase();

    return (
      normalized === 'elastic-git-storage' ||
      normalized === 'elastic-git-storage.exe' ||
      normalized.endsWith('/elastic-git-storage') ||
      normalized.endsWith('\\elastic-git-storage') ||
      normalized.endsWith('/elastic-git-storage.exe') ||
      normalized.endsWith('\\elastic-git-storage.exe')
    );
  }

  /**
   * Resolve the full path to the elastic-git-storage executable.
   *
   * Search order:
   * 1. The provided path (if it's a full path and exists)
   * 2. $PATH lookup via `which` / `where`
   * 3. Known install locations ($RUNNER_TOOL_CACHE, /usr/local/bin, ~/.local/bin)
   *
   * @returns Full path to the executable, or empty string if not found
   */
  static async findInstalled(): Promise<string> {
    // Check PATH
    try {
      const whichCmd = os.platform() === 'win32' ? 'where elastic-git-storage' : 'which elastic-git-storage';
      const result = await OrchestratorSystem.Run(whichCmd, false, true);
      const foundPath = result.trim().split('\n')[0].trim();
      if (foundPath && fs.existsSync(foundPath)) {
        return foundPath;
      }
    } catch {
      // Not on PATH
    }

    // Check common install locations
    const candidates = [
      path.join(process.env.RUNNER_TOOL_CACHE || '', 'elastic-git-storage', 'elastic-git-storage'),
      '/usr/local/bin/elastic-git-storage',
      path.join(os.homedir(), '.local', 'bin', 'elastic-git-storage'),
    ];

    if (os.platform() === 'win32') {
      candidates.push(
        path.join(process.env.RUNNER_TOOL_CACHE || '', 'elastic-git-storage', 'elastic-git-storage.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'elastic-git-storage', 'elastic-git-storage.exe'),
      );
    }

    for (const candidate of candidates) {
      if (candidate && fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return '';
  }

  /**
   * Install elastic-git-storage from GitHub releases.
   *
   * @param version - Version to install (e.g., 'v1.0.0', 'latest')
   * @returns Path to the installed executable
   */
  static async install(version: string = 'latest'): Promise<string> {
    const platform = os.platform();
    const arch = os.arch();

    const osName = platform === 'win32' ? 'windows' : platform === 'darwin' ? 'darwin' : 'linux';
    const archName = arch === 'x64' ? 'amd64' : arch === 'arm64' ? 'arm64' : 'amd64';
    const ext = platform === 'win32' ? '.exe' : '';

    const installDir = process.env.RUNNER_TOOL_CACHE
      ? path.join(process.env.RUNNER_TOOL_CACHE, 'elastic-git-storage')
      : path.join(os.tmpdir(), 'elastic-git-storage');

    const binaryName = `elastic-git-storage${ext}`;
    const installPath = path.join(installDir, binaryName);

    OrchestratorLogger.log(`[ElasticGitStorage] Installing to ${installPath}`);

    // Create install directory
    fs.mkdirSync(installDir, { recursive: true });

    // Build download URL
    const releaseTag = version === 'latest' ? 'latest' : version;
    const assetName = `elastic-git-storage_${osName}_${archName}${ext}`;

    let downloadUrl: string;
    if (releaseTag === 'latest') {
      downloadUrl = `https://github.com/${ElasticGitStorageService.REPO_OWNER}/${ElasticGitStorageService.REPO_NAME}/releases/latest/download/${assetName}`;
    } else {
      downloadUrl = `https://github.com/${ElasticGitStorageService.REPO_OWNER}/${ElasticGitStorageService.REPO_NAME}/releases/download/${releaseTag}/${assetName}`;
    }

    OrchestratorLogger.log(`[ElasticGitStorage] Downloading from ${downloadUrl}`);

    try {
      await OrchestratorSystem.Run(`curl -fsSL -o "${installPath}" "${downloadUrl}"`);

      if (platform !== 'win32') {
        await OrchestratorSystem.Run(`chmod +x "${installPath}"`);
      }

      // Verify installation
      if (!fs.existsSync(installPath)) {
        throw new Error(`Binary not found after download at ${installPath}`);
      }

      OrchestratorLogger.log(`[ElasticGitStorage] Successfully installed ${releaseTag} to ${installPath}`);

      return installPath;
    } catch (error: any) {
      OrchestratorLogger.logWarning(
        `[ElasticGitStorage] Failed to install: ${error.message}. Continuing without elastic-git-storage.`,
      );

      return '';
    }
  }

  /**
   * Ensure elastic-git-storage is available (find or install) and configure it.
   *
   * @param version - Version to install if not found ('latest' or a tag like 'v1.0.0')
   * @param agentArgs - Additional arguments to pass to the agent
   * @param storagePaths - Storage paths for the agent
   * @param repoPath - Path to the git repository
   * @returns Path to the configured executable, or empty string if setup failed
   */
  static async ensureAndConfigure(
    version: string,
    agentArgs: string,
    storagePaths: string[],
    repoPath: string,
  ): Promise<string> {
    OrchestratorLogger.log(`[ElasticGitStorage] Setting up elastic-git-storage (version: ${version || 'latest'})`);

    // Try to find existing installation
    let agentPath = await ElasticGitStorageService.findInstalled();

    if (agentPath) {
      OrchestratorLogger.log(`[ElasticGitStorage] Found existing installation at ${agentPath}`);
    } else {
      OrchestratorLogger.log(`[ElasticGitStorage] Not found on system, installing...`);
      agentPath = await ElasticGitStorageService.install(version || 'latest');

      if (!agentPath) {
        return '';
      }
    }

    // Delegate to LfsAgentService for git config setup
    await LfsAgentService.configure(agentPath, agentArgs, storagePaths, repoPath);

    return agentPath;
  }
}
