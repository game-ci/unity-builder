import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { OrchestratorSystem } from '../core/orchestrator-system';
import OrchestratorLogger from '../core/orchestrator-logger';

export class GitHooksService {
  /**
   * Detect which git hook framework is configured in the repository.
   * Checks for lefthook and husky configuration files.
   */
  static detectHookFramework(repoPath: string): 'lefthook' | 'husky' | 'none' {
    // Check for lefthook config files
    if (fs.existsSync(path.join(repoPath, 'lefthook.yml')) || fs.existsSync(path.join(repoPath, '.lefthook.yml'))) {
      return 'lefthook';
    }

    // Check for husky directory
    if (fs.existsSync(path.join(repoPath, '.husky'))) {
      return 'husky';
    }

    return 'none';
  }

  /**
   * Install git hooks using the detected framework.
   * Errors are caught and logged as warnings - hook installation should not fail the build.
   */
  static async installHooks(repoPath: string): Promise<void> {
    const framework = GitHooksService.detectHookFramework(repoPath);

    if (framework === 'none') {
      OrchestratorLogger.log(`[GitHooks] No hook framework detected in ${repoPath}`);

      return;
    }

    OrchestratorLogger.log(`[GitHooks] Detected hook framework: ${framework}`);

    try {
      if (framework === 'lefthook') {
        await OrchestratorSystem.Run(`cd "${repoPath}" && npx lefthook install`, true);
        OrchestratorLogger.log(`[GitHooks] Lefthook hooks installed`);
      } else if (framework === 'husky') {
        await OrchestratorSystem.Run(`cd "${repoPath}" && npx husky install`, true);
        OrchestratorLogger.log(`[GitHooks] Husky hooks installed`);
      }
    } catch (error: any) {
      OrchestratorLogger.logWarning(`[GitHooks] Hook installation failed: ${error.message}`);
    }
  }

  /**
   * Return environment variables that will skip the listed hooks.
   * For lefthook: sets LEFTHOOK_EXCLUDE to a comma-separated list.
   * For husky: sets HUSKY=0 to disable all hooks (husky does not support selective skipping).
   * The caller is responsible for applying the returned env vars.
   */
  static configureSkipList(skipList: string[]): Record<string, string> {
    if (skipList.length === 0) {
      return {};
    }

    // Return both lefthook and husky env vars so the caller can apply whichever is relevant.
    // Lefthook supports selective hook exclusion.
    const env: Record<string, string> = {
      LEFTHOOK_EXCLUDE: skipList.join(','),
    };

    // Husky only supports full disable (HUSKY=0), not selective skipping.
    // If any hooks are in the skip list, disable husky entirely.
    env.HUSKY = '0';

    OrchestratorLogger.log(`[GitHooks] Skip list configured: ${skipList.join(', ')}`);

    return env;
  }

  /**
   * Disable all git hooks by pointing core.hooksPath to an empty temporary directory.
   * This prevents any hooks from running during the build.
   */
  static async disableHooks(repoPath: string): Promise<void> {
    try {
      const emptyDir = path.join(os.tmpdir(), 'game-ci-empty-hooks');
      fs.mkdirSync(emptyDir, { recursive: true });

      await OrchestratorSystem.Run(`git -C "${repoPath}" config core.hooksPath "${emptyDir}"`, true);

      OrchestratorLogger.log(`[GitHooks] Hooks disabled via core.hooksPath -> ${emptyDir}`);
    } catch (error: any) {
      OrchestratorLogger.logWarning(`[GitHooks] Failed to disable hooks: ${error.message}`);
    }
  }
}
