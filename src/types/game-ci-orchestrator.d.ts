/**
 * Type declarations for @game-ci/orchestrator.
 *
 * This optional dependency provides remote build orchestration and plugin
 * services. When installed, the plugin loader in orchestrator-plugin.ts
 * dynamically imports it.
 */
declare module '@game-ci/orchestrator' {
  interface OrchestratorPlugin {
    initialize(coreParams: Record<string, any>, workspace: string): Promise<void>;
    canHandleBuild(): boolean;
    handleBuild(baseImage: string): Promise<{ exitCode: number; fallbackToLocal?: boolean }>;
    beforeLocalBuild(workspace: string): Promise<void>;
    afterLocalBuild(workspace: string, exitCode: number): Promise<void>;
    handlePostBuild(exitCode: number): Promise<void>;
  }

  /**
   * Create an orchestrator plugin instance.
   * The plugin reads its own configuration from environment variables
   * and GitHub Actions inputs — unity-builder does not need to proxy them.
   */
  export function createPlugin(): OrchestratorPlugin;

  // Legacy export — kept for backward compatibility with CLI and direct consumers
  export const Orchestrator: {
    run: (arg0: any, arg1: string) => Promise<{ BuildSucceeded: boolean; BuildResults: string }>;
    setup: (arg0: any) => Promise<void>;
    buildParameters: any;
    lockedWorkspace: string;
  };
}
