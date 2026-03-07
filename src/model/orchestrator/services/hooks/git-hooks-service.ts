import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { OrchestratorSystem } from '../core/orchestrator-system';
import OrchestratorLogger from '../core/orchestrator-logger';

export class GitHooksService {
  static readonly UNITY_GIT_HOOKS_PACKAGE = 'com.frostebite.unitygithooks';

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
   * Detect if Unity Git Hooks (com.frostebite.unitygithooks) is installed as a UPM package.
   * Checks Packages/manifest.json for the package dependency.
   */
  static detectUnityGitHooks(repoPath: string): boolean {
    const manifestPath = path.join(repoPath, 'Packages', 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return false;
    }

    try {
      const content = fs.readFileSync(manifestPath, 'utf8');

      return content.includes(GitHooksService.UNITY_GIT_HOOKS_PACKAGE);
    } catch {
      return false;
    }
  }

  /**
   * Find the Unity Git Hooks package directory in the Library/PackageCache.
   * Returns the path to the package directory, or empty string if not found.
   */
  static findUnityGitHooksPackagePath(repoPath: string): string {
    const packageCacheDir = path.join(repoPath, 'Library', 'PackageCache');
    if (!fs.existsSync(packageCacheDir)) {
      return '';
    }

    try {
      const entries = fs.readdirSync(packageCacheDir);
      const match = entries.find((entry) => entry.startsWith(GitHooksService.UNITY_GIT_HOOKS_PACKAGE));
      if (match) {
        return path.join(packageCacheDir, match);
      }
    } catch {
      // PackageCache not available
    }

    return '';
  }

  /**
   * Initialize Unity Git Hooks by running its init script.
   * This installs the required npm modules that the hooks depend on.
   * Should be called before installHooks() when Unity Git Hooks is detected.
   */
  static async initUnityGitHooks(repoPath: string): Promise<void> {
    const packagePath = GitHooksService.findUnityGitHooksPackagePath(repoPath);
    if (!packagePath) {
      OrchestratorLogger.log(`[GitHooks] Unity Git Hooks package not found in Library/PackageCache, skipping init`);

      return;
    }

    const initScript = path.join(packagePath, '~js', 'init-unity-lefthook.js');
    if (!fs.existsSync(initScript)) {
      OrchestratorLogger.logWarning(`[GitHooks] Unity Git Hooks init script not found at ${initScript}`);

      return;
    }

    OrchestratorLogger.log(`[GitHooks] Initializing Unity Git Hooks from ${packagePath}`);

    try {
      await OrchestratorSystem.Run(`cd "${repoPath}" && node "${initScript}"`, true);
      OrchestratorLogger.log(`[GitHooks] Unity Git Hooks initialized successfully`);
    } catch (error: any) {
      OrchestratorLogger.logWarning(`[GitHooks] Unity Git Hooks init failed: ${error.message}`);
    }
  }

  /**
   * Configure CI-friendly environment variables for Unity Git Hooks.
   * Disables background project mode (CI already has an isolated workspace)
   * and sets other env vars appropriate for headless CI environments.
   */
  static configureUnityGitHooksCIEnv(): Record<string, string> {
    return {
      UNITY_GITHOOKS_BACKGROUND_PROJECT_ENABLED: 'false',
      CI: 'true',
    };
  }

  /**
   * Install git hooks using the detected framework.
   * If Unity Git Hooks is detected, initializes it first.
   * Errors are caught and logged as warnings - hook installation should not fail the build.
   */
  static async installHooks(repoPath: string): Promise<void> {
    const framework = GitHooksService.detectHookFramework(repoPath);

    if (framework === 'none') {
      OrchestratorLogger.log(`[GitHooks] No hook framework detected in ${repoPath}`);

      return;
    }

    OrchestratorLogger.log(`[GitHooks] Detected hook framework: ${framework}`);

    // If Unity Git Hooks is present, initialize it before installing hooks
    if (framework === 'lefthook' && GitHooksService.detectUnityGitHooks(repoPath)) {
      OrchestratorLogger.log(`[GitHooks] Unity Git Hooks (UPM) detected, running init`);

      // Set CI-friendly env vars
      const ciEnv = GitHooksService.configureUnityGitHooksCIEnv();
      for (const [key, value] of Object.entries(ciEnv)) {
        process.env[key] = value;
      }

      await GitHooksService.initUnityGitHooks(repoPath);
    }

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
   * Explicitly run specific lefthook hook groups before the build.
   * This allows CI to trigger pre-commit, pre-push, or other checks
   * that would normally only run on git events.
   *
   * @param repoPath - Path to the repository
   * @param hookGroups - Lefthook group names to run (e.g., ['pre-commit', 'pre-push'])
   * @returns Map of group name to success/failure
   */
  static async runHookGroups(repoPath: string, hookGroups: string[]): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    if (hookGroups.length === 0) {
      return results;
    }

    const framework = GitHooksService.detectHookFramework(repoPath);
    if (framework !== 'lefthook') {
      OrchestratorLogger.logWarning(`[GitHooks] runHookGroups requires lefthook, but detected: ${framework}`);

      return results;
    }

    OrchestratorLogger.log(`[GitHooks] Running ${hookGroups.length} hook group(s): ${hookGroups.join(', ')}`);

    for (const group of hookGroups) {
      try {
        await OrchestratorSystem.Run(`cd "${repoPath}" && npx lefthook run ${group}`, true);
        OrchestratorLogger.log(`[GitHooks] Hook group '${group}' passed`);
        results[group] = true;
      } catch (error: any) {
        OrchestratorLogger.logWarning(`[GitHooks] Hook group '${group}' failed: ${error.message}`);
        results[group] = false;
      }
    }

    return results;
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
