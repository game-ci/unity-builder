import * as core from '@actions/core';

/**
 * Lifecycle interface for the orchestrator plugin.
 *
 * The orchestrator reads its own configuration from environment variables
 * and GitHub Actions inputs. Unity-builder only calls these lifecycle hooks
 * at the appropriate times — it never needs to know individual plugin params.
 */
export interface OrchestratorPlugin {
  // eslint-disable-next-line no-unused-vars
  initialize(coreParameters: Record<string, any>, workspace: string): Promise<void>;

  /** Whether the plugin wants to handle the entire build (remote, hot runner, test workflow). */
  canHandleBuild(): boolean;

  /**
   * Execute the build when canHandleBuild() returns true.
   * If the plugin needs to fall back to a local build (e.g. hot runner failure),
   * it returns { exitCode: -1, fallbackToLocal: true }.
   */
  // eslint-disable-next-line no-unused-vars
  handleBuild(baseImage: string): Promise<{ exitCode: number; fallbackToLocal?: boolean }>;

  /** Pre-build hook for local builds (cache restore, git hooks, sync, etc.). */
  // eslint-disable-next-line no-unused-vars
  beforeLocalBuild(workspace: string): Promise<void>;

  /** Post-build hook for local builds (cache save, workspace save, etc.). */
  // eslint-disable-next-line no-unused-vars
  afterLocalBuild(workspace: string, exitCode: number): Promise<void>;

  /** Post-build hook for all build types (archiving, artifacts, etc.). */
  // eslint-disable-next-line no-unused-vars
  handlePostBuild(exitCode: number): Promise<void>;
}

/**
 * Attempt to load the orchestrator plugin.
 * Returns undefined if @game-ci/orchestrator is not installed.
 */
export async function loadOrchestratorPlugin(): Promise<OrchestratorPlugin | undefined> {
  try {
    // eslint-disable-next-line import/no-unresolved
    const orchestratorModule = await import('@game-ci/orchestrator');

    if (typeof orchestratorModule.createPlugin !== 'function') {
      core.warning(
        'Orchestrator package found but does not export createPlugin(). ' +
          'Update @game-ci/orchestrator to the latest version.',
      );

      return;
    }

    return orchestratorModule.createPlugin();
  } catch (error) {
    if (!isModuleNotFoundError(error)) {
      throw error;
    }
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
