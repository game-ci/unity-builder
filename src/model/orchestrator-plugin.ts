/**
 * Orchestrator plugin loader.
 *
 * After extraction, the orchestrator lives in @game-ci/orchestrator.
 * This module provides a thin loader that dynamically imports it,
 * falling back gracefully if the package is not installed.
 *
 * During the extraction transition period, this imports from the local
 * source. Once extraction is complete, the import path changes to the
 * npm package.
 */

import * as core from '@actions/core';

export interface OrchestratorPluginResult {
  exitCode: number;
  BuildSucceeded: boolean;
}

/**
 * Load the orchestrator for remote builds.
 * Returns undefined if orchestrator is not available.
 */
export async function loadOrchestrator(): Promise<
  | {
      // eslint-disable-next-line no-unused-vars
      run: (buildParameters: any, baseImage: string) => Promise<OrchestratorPluginResult>;
    }
  | undefined
> {
  try {
    // During extraction transition: import from local source
    // After extraction: import from '@game-ci/orchestrator'
    const { default: Orchestrator } = await import('./orchestrator/orchestrator');

    return {
      run: async (buildParameters: any, baseImage: string): Promise<OrchestratorPluginResult> => {
        const result = await Orchestrator.run(buildParameters, baseImage);

        return {
          exitCode: result.BuildSucceeded ? 0 : 1,
          BuildSucceeded: result.BuildSucceeded,
        };
      },
    };
  } catch {
    // Orchestrator package not installed
  }
}

/**
 * Load enterprise services for local builds.
 * These services are part of the orchestrator but also used in local builds
 * (child workspaces, local cache, git hooks, LFS agents, etc.).
 */
export async function loadEnterpriseServices() {
  try {
    const [
      { BuildReliabilityService },
      { TestWorkflowService },
      { HotRunnerService },
      { OutputService },
      { OutputTypeRegistry },
      { ArtifactUploadHandler },
      { IncrementalSyncService },
    ] = await Promise.all([
      import('./orchestrator/services/reliability'),
      import('./orchestrator/services/test-workflow'),
      import('./orchestrator/services/hot-runner'),
      import('./orchestrator/services/output/output-service'),
      import('./orchestrator/services/output/output-type-registry'),
      import('./orchestrator/services/output/artifact-upload-handler'),
      import('./orchestrator/services/sync'),
    ]);

    return {
      BuildReliabilityService,
      TestWorkflowService,
      HotRunnerService,
      OutputService,
      OutputTypeRegistry,
      ArtifactUploadHandler,
      IncrementalSyncService,

      // Lazy-loaded services (only imported when needed)
      async loadChildWorkspaceService() {
        const m = await import('./orchestrator/services/cache/child-workspace-service');

        return m.ChildWorkspaceService;
      },

      async loadLocalCacheService() {
        const m = await import('./orchestrator/services/cache/local-cache-service');

        return m.LocalCacheService;
      },

      async loadSubmoduleProfileService() {
        const m = await import('./orchestrator/services/submodule/submodule-profile-service');

        return m.SubmoduleProfileService;
      },

      async loadLfsAgentService() {
        const m = await import('./orchestrator/services/lfs/lfs-agent-service');

        return m.LfsAgentService;
      },

      async loadGitHooksService() {
        const m = await import('./orchestrator/services/hooks/git-hooks-service');

        return m.GitHooksService;
      },
    };
  } catch (error) {
    core.warning(`Enterprise services not available: ${(error as Error).message}`);
  }
}
