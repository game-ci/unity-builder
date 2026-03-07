import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { SubmoduleProfile, SubmoduleEntry, SubmoduleInitAction, SubmoduleInitPlan } from './submodule-profile-types';
import { OrchestratorSystem } from '../core/orchestrator-system';
import OrchestratorLogger from '../core/orchestrator-logger';

export class SubmoduleProfileService {
  /**
   * Parse a submodule profile YAML file and return the typed profile.
   */
  static parseProfile(profilePath: string): SubmoduleProfile {
    if (!fs.existsSync(profilePath)) {
      throw new Error(`Submodule profile not found: ${profilePath}`);
    }

    const raw = fs.readFileSync(profilePath, 'utf8');
    let parsed: any;
    try {
      parsed = YAML.parse(raw);
    } catch (error: any) {
      throw new Error(`Failed to parse submodule profile YAML at ${profilePath}: ${error.message}`);
    }

    if (!parsed || !Array.isArray(parsed.submodules)) {
      throw new Error(`Invalid submodule profile: expected 'submodules' array in ${profilePath}`);
    }

    return {
      primary_submodule: parsed.primary_submodule,
      product_name: parsed.product_name,
      submodules: parsed.submodules.map((entry: any) => ({
        name: String(entry.name),
        branch: String(entry.branch),
      })),
    };
  }

  /**
   * Merge a variant profile on top of a base profile.
   * Variant submodule entries override base entries matched by name.
   * New variant entries are appended.
   * Scalar fields (primary_submodule, product_name) are replaced by variant values.
   */
  static mergeVariant(base: SubmoduleProfile, variantPath: string): SubmoduleProfile {
    if (!fs.existsSync(variantPath)) {
      throw new Error(`Submodule variant not found: ${variantPath}`);
    }

    const variant = SubmoduleProfileService.parseProfile(variantPath);

    // Start with a copy of base submodules
    const mergedEntries = new Map<string, SubmoduleEntry>();
    for (const entry of base.submodules) {
      mergedEntries.set(entry.name, { ...entry });
    }

    // Overlay variant entries
    for (const entry of variant.submodules) {
      mergedEntries.set(entry.name, { ...entry });
    }

    return {
      primary_submodule: variant.primary_submodule ?? base.primary_submodule,
      product_name: variant.product_name ?? base.product_name,
      submodules: [...mergedEntries.values()],
    };
  }

  /**
   * Parse the .gitmodules file from a repository and return a map of submodule name -> path.
   */
  static parseGitmodules(repoPath: string): Map<string, string> {
    const gitmodulesPath = path.join(repoPath, '.gitmodules');
    const result = new Map<string, string>();

    if (!fs.existsSync(gitmodulesPath)) {
      return result;
    }

    const content = fs.readFileSync(gitmodulesPath, 'utf8');
    const lines = content.split('\n');

    let currentName: string | undefined;

    for (const line of lines) {
      const trimmed = line.trim();

      // Match [submodule "name"]
      const submoduleMatch = trimmed.match(/^\[submodule\s+"(.+)"\]$/);
      if (submoduleMatch) {
        currentName = submoduleMatch[1];
        continue;
      }

      // Match path = value
      const pathMatch = trimmed.match(/^path\s*=\s*(.+)$/);
      if (pathMatch && currentName) {
        result.set(currentName, pathMatch[1].trim());
      }
    }

    return result;
  }

  /**
   * Match a submodule name/path against a profile pattern.
   * Supports exact match and glob-like patterns (only `*` wildcard at end).
   * Matches against both the full submodule path and the leaf folder name.
   */
  static matchSubmodule(submoduleName: string, pattern: string): boolean {
    // Check for trailing wildcard
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);

      // Match against full path
      if (submoduleName.startsWith(prefix)) {
        return true;
      }

      // Match against leaf folder name
      const leaf = submoduleName.split('/').pop() || '';
      if (leaf.startsWith(prefix)) {
        return true;
      }

      return false;
    }

    // Exact match against full path
    if (submoduleName === pattern) {
      return true;
    }

    // Exact match against leaf folder name
    const leaf = submoduleName.split('/').pop() || '';
    if (leaf === pattern) {
      return true;
    }

    return false;
  }

  /**
   * Create an initialization plan by matching .gitmodules entries against profile rules.
   * Unmatched submodules default to 'skip'.
   */
  static async createInitPlan(profilePath: string, variantPath: string, repoPath: string): Promise<SubmoduleInitPlan> {
    let profile = SubmoduleProfileService.parseProfile(profilePath);

    if (variantPath) {
      profile = SubmoduleProfileService.mergeVariant(profile, variantPath);
    }

    const gitmodules = SubmoduleProfileService.parseGitmodules(repoPath);
    const plan: SubmoduleInitPlan = [];

    for (const [name, submodulePath] of gitmodules) {
      let matchedEntry: SubmoduleEntry | undefined;

      for (const entry of profile.submodules) {
        if (
          SubmoduleProfileService.matchSubmodule(name, entry.name) ||
          SubmoduleProfileService.matchSubmodule(submodulePath, entry.name)
        ) {
          matchedEntry = entry;
          break;
        }
      }

      if (matchedEntry) {
        const action: SubmoduleInitAction = {
          name,
          path: submodulePath,
          branch: matchedEntry.branch,
          action: matchedEntry.branch === 'empty' ? 'skip' : 'init',
        };
        plan.push(action);
      } else {
        // Unmatched submodules default to skip
        plan.push({
          name,
          path: submodulePath,
          branch: 'empty',
          action: 'skip',
        });
      }
    }

    return plan;
  }

  /**
   * Execute a submodule initialization plan.
   * Configures auth if token is provided, then inits or deinits each submodule.
   */
  static async execute(plan: SubmoduleInitPlan, repoPath: string, token?: string): Promise<void> {
    if (token) {
      OrchestratorLogger.log('Configuring git authentication for submodule initialization...');
      await OrchestratorSystem.Run(`git config url."https://${token}@github.com/".insteadOf "https://github.com/"`);
    }

    for (const action of plan) {
      const fullPath = path.posix.join(repoPath, action.path).replace(/\\/g, '/');

      if (action.action === 'init') {
        OrchestratorLogger.log(`Initializing submodule: ${action.name} (branch: ${action.branch})`);
        await OrchestratorSystem.Run(`git submodule update --init ${action.path}`);

        if (action.branch !== 'main') {
          OrchestratorLogger.log(`Checking out branch '${action.branch}' for submodule: ${action.name}`);
          await OrchestratorSystem.Run(`git -C ${action.path} checkout ${action.branch}`);
        }
      } else {
        OrchestratorLogger.log(`Skipping submodule: ${action.name}`);
        await OrchestratorSystem.Run(`git submodule deinit -f ${action.path} 2>/dev/null || true`);
      }
    }

    OrchestratorLogger.log(
      `Submodule initialization complete: ${plan.filter((a) => a.action === 'init').length} initialized, ${
        plan.filter((a) => a.action === 'skip').length
      } skipped`,
    );
  }
}
