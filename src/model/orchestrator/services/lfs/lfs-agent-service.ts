import fs from 'node:fs';
import path from 'node:path';
import { OrchestratorSystem } from '../core/orchestrator-system';
import OrchestratorLogger from '../core/orchestrator-logger';

export class LfsAgentService {
  /**
   * Configure a custom LFS transfer agent in a git repository.
   * Sets up the git config entries and environment variables needed for the agent.
   */
  static async configure(
    agentPath: string,
    agentArgs: string,
    storagePaths: string[],
    repoPath: string,
  ): Promise<void> {
    // Validate the agent executable exists
    if (!fs.existsSync(agentPath)) {
      OrchestratorLogger.logWarning(
        `[LfsAgent] Agent executable not found at ${agentPath}, continuing without custom LFS agent`,
      );

      return;
    }

    // Derive agent name from executable filename (without extension)
    const agentName = path.basename(agentPath, path.extname(agentPath));

    OrchestratorLogger.log(`[LfsAgent] Configuring custom LFS transfer agent: ${agentName}`);
    OrchestratorLogger.log(`[LfsAgent]   Path: ${agentPath}`);
    OrchestratorLogger.log(`[LfsAgent]   Args: ${agentArgs}`);

    // Set git config entries for the custom transfer agent
    await OrchestratorSystem.Run(`git -C "${repoPath}" config lfs.customtransfer.${agentName}.path "${agentPath}"`);
    await OrchestratorSystem.Run(`git -C "${repoPath}" config lfs.customtransfer.${agentName}.args "${agentArgs}"`);
    await OrchestratorSystem.Run(`git -C "${repoPath}" config lfs.standalonetransferagent ${agentName}`);

    // Set storage paths environment variable if provided
    if (storagePaths.length > 0) {
      const storagePathsValue = storagePaths.join(';');
      process.env.LFS_STORAGE_PATHS = storagePathsValue;
      OrchestratorLogger.log(`[LfsAgent]   Storage paths: ${storagePathsValue}`);
    }

    OrchestratorLogger.log(`[LfsAgent] Custom LFS transfer agent configured successfully`);
  }

  /**
   * Validate that the LFS transfer agent executable exists.
   */
  static async validate(agentPath: string): Promise<boolean> {
    const exists = fs.existsSync(agentPath);
    if (!exists) {
      OrchestratorLogger.logWarning(`[LfsAgent] Agent executable not found: ${agentPath}`);
    }

    return exists;
  }
}
