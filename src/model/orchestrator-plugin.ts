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
    // eslint-disable-next-line import/no-unresolved
    const { Orchestrator } = await import('@game-ci/orchestrator');

    return {
      run: async (buildParameters: any, baseImage: string): Promise<OrchestratorPluginResult> => {
        const result = await Orchestrator.run(buildParameters, baseImage);

        return {
          exitCode: result.BuildSucceeded ? 0 : 1,
          BuildSucceeded: result.BuildSucceeded,
        };
      },
    };
  } catch (error) {
    if (!isModuleNotFoundError(error)) {
      throw error;
    }
  }
}

/**
 * Load orchestrator plugin services for local builds.
 * These services are part of the orchestrator but also used in local builds
 * (child workspaces, local cache, git hooks, LFS agents, etc.).
 */
export async function loadPluginServices() {
  try {
    // eslint-disable-next-line import/no-unresolved
    const orchestrator = await import('@game-ci/orchestrator');

    return {
      BuildReliabilityService: orchestrator.BuildReliabilityService,
      TestWorkflowService: orchestrator.TestWorkflowService,
      HotRunnerService: orchestrator.HotRunnerService,
      OutputService: orchestrator.OutputService,
      OutputTypeRegistry: orchestrator.OutputTypeRegistry,
      ArtifactUploadHandler: orchestrator.ArtifactUploadHandler,
      IncrementalSyncService: orchestrator.IncrementalSyncService,

      // Lazy-loaded services (only imported when needed)
      async loadChildWorkspaceService() {
        return orchestrator.ChildWorkspaceService;
      },

      async loadLocalCacheService() {
        return orchestrator.LocalCacheService;
      },

      async loadSubmoduleProfileService() {
        return orchestrator.SubmoduleProfileService;
      },

      async loadLfsAgentService() {
        return orchestrator.LfsAgentService;
      },

      async loadGitHooksService() {
        return orchestrator.GitHooksService;
      },
    };
  } catch (error) {
    if (!isModuleNotFoundError(error)) {
      throw error;
    }
    core.warning(`Orchestrator plugin not available: ${(error as Error).message}`);
  }
}

function isModuleNotFoundError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code;
    if (code === 'MODULE_NOT_FOUND' || code === 'ERR_MODULE_NOT_FOUND') {
      return true;
    }
  }

  return typeof (error as Error)?.message === 'string' && /cannot find module/i.test((error as Error).message);
}
