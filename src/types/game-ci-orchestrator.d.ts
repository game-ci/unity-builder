/**
 * Type declarations for @game-ci/orchestrator.
 *
 * This optional dependency provides remote build orchestration and plugin
 * services. When installed, the plugin loader in orchestrator-plugin.ts
 * dynamically imports it.
 */
declare module '@game-ci/orchestrator' {
  export const Orchestrator: {
    run: (arg0: any, arg1: string) => Promise<{ BuildSucceeded: boolean; BuildResults: string }>;
    setup: (arg0: any) => Promise<void>;
    buildParameters: any;
    lockedWorkspace: string;
  };

  export const BuildReliabilityService: any;
  export const TestWorkflowService: any;
  export const HotRunnerService: any;
  export const OutputService: any;
  export const OutputTypeRegistry: any;
  export const ArtifactUploadHandler: any;
  export const IncrementalSyncService: any;
  export const ChildWorkspaceService: any;
  export const LocalCacheService: any;
  export const SubmoduleProfileService: any;
  export const LfsAgentService: any;
  export const GitHooksService: any;
}
