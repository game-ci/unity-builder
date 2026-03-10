/**
 * Tests for the orchestrator plugin interface (orchestrator-plugin.ts).
 *
 * The plugin acts as a dynamic bridge to @game-ci/orchestrator, which is an
 * optional dependency.  Two scenarios exist:
 *
 * 1. Package NOT installed (the natural state in unity-builder) -- both
 *    loadOrchestrator() and loadEnterpriseServices() must degrade gracefully.
 *
 * 2. Package IS installed (mocked) -- the returned wrappers must faithfully
 *    forward calls and map results.
 */

// Mock @actions/core so we can inspect core.warning calls even after
// jest.resetModules() re-imports orchestrator-plugin (which statically
// imports @actions/core at the top level).
const mockWarning = jest.fn();
jest.mock('@actions/core', () => ({
  warning: mockWarning,
}));

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.resetModules();
  mockWarning.mockClear();
});

// ---------------------------------------------------------------------------
// Part 1: Package NOT installed (natural state)
// ---------------------------------------------------------------------------

describe('orchestrator-plugin (package not installed)', () => {
  it('loadOrchestrator() returns undefined', async () => {
    const { loadOrchestrator } = await import('./orchestrator-plugin');

    const result = await loadOrchestrator();

    expect(result).toBeUndefined();
  });

  it('loadEnterpriseServices() returns undefined and logs a warning', async () => {
    const { loadEnterpriseServices } = await import('./orchestrator-plugin');

    const result = await loadEnterpriseServices();

    expect(result).toBeUndefined();
    expect(mockWarning).toHaveBeenCalledTimes(1);
    expect(mockWarning).toHaveBeenCalledWith(expect.stringContaining('Enterprise services not available'));
  });
});

// ---------------------------------------------------------------------------
// Part 2: Package IS installed (mocked)
// ---------------------------------------------------------------------------

describe('orchestrator-plugin (package installed)', () => {
  // Fake service sentinels -- unique objects so we can assert identity.
  const fakeBuildReliabilityService = { _id: 'BuildReliabilityService' };
  const fakeTestWorkflowService = { _id: 'TestWorkflowService' };
  const fakeHotRunnerService = { _id: 'HotRunnerService' };
  const fakeOutputService = { _id: 'OutputService' };
  const fakeOutputTypeRegistry = { _id: 'OutputTypeRegistry' };
  const fakeArtifactUploadHandler = { _id: 'ArtifactUploadHandler' };
  const fakeIncrementalSyncService = { _id: 'IncrementalSyncService' };
  const fakeChildWorkspaceService = { _id: 'ChildWorkspaceService' };
  const fakeLocalCacheService = { _id: 'LocalCacheService' };
  const fakeSubmoduleProfileService = { _id: 'SubmoduleProfileService' };
  const fakeLfsAgentService = { _id: 'LfsAgentService' };
  const fakeGitHooksService = { _id: 'GitHooksService' };

  const mockOrchestratorRun = jest.fn();

  /**
   * Install the mock BEFORE importing orchestrator-plugin so that the dynamic
   * import('@game-ci/orchestrator') inside loadOrchestrator / loadEnterpriseServices
   * resolves to our fake module.
   *
   * The { virtual: true } flag is required because @game-ci/orchestrator is
   * not physically installed in unity-builder's node_modules.
   */
  function installOrchestratorMock(overrides: Record<string, unknown> = {}) {
    jest.doMock(
      '@game-ci/orchestrator',
      () => ({
        Orchestrator: { run: mockOrchestratorRun },
        BuildReliabilityService: fakeBuildReliabilityService,
        TestWorkflowService: fakeTestWorkflowService,
        HotRunnerService: fakeHotRunnerService,
        OutputService: fakeOutputService,
        OutputTypeRegistry: fakeOutputTypeRegistry,
        ArtifactUploadHandler: fakeArtifactUploadHandler,
        IncrementalSyncService: fakeIncrementalSyncService,
        ChildWorkspaceService: fakeChildWorkspaceService,
        LocalCacheService: fakeLocalCacheService,
        SubmoduleProfileService: fakeSubmoduleProfileService,
        LfsAgentService: fakeLfsAgentService,
        GitHooksService: fakeGitHooksService,
        ...overrides,
      }),
      { virtual: true },
    );
  }

  beforeEach(() => {
    mockOrchestratorRun.mockReset();
  });

  // -----------------------------------------------------------------------
  // loadOrchestrator()
  // -----------------------------------------------------------------------

  describe('loadOrchestrator()', () => {
    it('returns an object with a run function', async () => {
      installOrchestratorMock();
      const { loadOrchestrator } = await import('./orchestrator-plugin');

      const orchestrator = await loadOrchestrator();

      expect(orchestrator).toBeDefined();
      expect(typeof orchestrator!.run).toBe('function');
    });

    it('run() maps BuildSucceeded=true to exitCode=0', async () => {
      mockOrchestratorRun.mockResolvedValue({ BuildSucceeded: true, BuildResults: 'ok' });
      installOrchestratorMock();
      const { loadOrchestrator } = await import('./orchestrator-plugin');

      const orchestrator = await loadOrchestrator();
      const result = await orchestrator!.run({}, 'ubuntu:latest');

      expect(result.exitCode).toBe(0);
      expect(result.BuildSucceeded).toBe(true);
    });

    it('run() maps BuildSucceeded=false to exitCode=1', async () => {
      mockOrchestratorRun.mockResolvedValue({ BuildSucceeded: false, BuildResults: 'fail' });
      installOrchestratorMock();
      const { loadOrchestrator } = await import('./orchestrator-plugin');

      const orchestrator = await loadOrchestrator();
      const result = await orchestrator!.run({}, 'ubuntu:latest');

      expect(result.exitCode).toBe(1);
      expect(result.BuildSucceeded).toBe(false);
    });

    it('run() passes buildParameters and baseImage to Orchestrator.run', async () => {
      const buildParameters = { targetPlatform: 'StandaloneLinux64', editorVersion: '2021.3.1f1' };
      const baseImage = 'unityci/editor:2021.3.1f1-linux-il2cpp-1';

      mockOrchestratorRun.mockResolvedValue({ BuildSucceeded: true, BuildResults: '' });
      installOrchestratorMock();
      const { loadOrchestrator } = await import('./orchestrator-plugin');

      const orchestrator = await loadOrchestrator();
      await orchestrator!.run(buildParameters, baseImage);

      expect(mockOrchestratorRun).toHaveBeenCalledTimes(1);
      expect(mockOrchestratorRun).toHaveBeenCalledWith(buildParameters, baseImage);
    });
  });

  // -----------------------------------------------------------------------
  // loadEnterpriseServices()
  // -----------------------------------------------------------------------

  describe('loadEnterpriseServices()', () => {
    it('returns all 7 eager services', async () => {
      installOrchestratorMock();
      const { loadEnterpriseServices } = await import('./orchestrator-plugin');

      const services = await loadEnterpriseServices();

      expect(services).toBeDefined();
      expect(services!.BuildReliabilityService).toBe(fakeBuildReliabilityService);
      expect(services!.TestWorkflowService).toBe(fakeTestWorkflowService);
      expect(services!.HotRunnerService).toBe(fakeHotRunnerService);
      expect(services!.OutputService).toBe(fakeOutputService);
      expect(services!.OutputTypeRegistry).toBe(fakeOutputTypeRegistry);
      expect(services!.ArtifactUploadHandler).toBe(fakeArtifactUploadHandler);
      expect(services!.IncrementalSyncService).toBe(fakeIncrementalSyncService);
    });

    it('returns all 5 lazy loader functions', async () => {
      installOrchestratorMock();
      const { loadEnterpriseServices } = await import('./orchestrator-plugin');

      const services = await loadEnterpriseServices();

      expect(services).toBeDefined();
      expect(typeof services!.loadChildWorkspaceService).toBe('function');
      expect(typeof services!.loadLocalCacheService).toBe('function');
      expect(typeof services!.loadSubmoduleProfileService).toBe('function');
      expect(typeof services!.loadLfsAgentService).toBe('function');
      expect(typeof services!.loadGitHooksService).toBe('function');
    });

    it('loadChildWorkspaceService() returns the correct service', async () => {
      installOrchestratorMock();
      const { loadEnterpriseServices } = await import('./orchestrator-plugin');

      const services = await loadEnterpriseServices();
      const service = await services!.loadChildWorkspaceService();

      expect(service).toBe(fakeChildWorkspaceService);
    });

    it('loadLocalCacheService() returns the correct service', async () => {
      installOrchestratorMock();
      const { loadEnterpriseServices } = await import('./orchestrator-plugin');

      const services = await loadEnterpriseServices();
      const service = await services!.loadLocalCacheService();

      expect(service).toBe(fakeLocalCacheService);
    });

    it('loadSubmoduleProfileService() returns the correct service', async () => {
      installOrchestratorMock();
      const { loadEnterpriseServices } = await import('./orchestrator-plugin');

      const services = await loadEnterpriseServices();
      const service = await services!.loadSubmoduleProfileService();

      expect(service).toBe(fakeSubmoduleProfileService);
    });

    it('loadLfsAgentService() returns the correct service', async () => {
      installOrchestratorMock();
      const { loadEnterpriseServices } = await import('./orchestrator-plugin');

      const services = await loadEnterpriseServices();
      const service = await services!.loadLfsAgentService();

      expect(service).toBe(fakeLfsAgentService);
    });

    it('loadGitHooksService() returns the correct service', async () => {
      installOrchestratorMock();
      const { loadEnterpriseServices } = await import('./orchestrator-plugin');

      const services = await loadEnterpriseServices();
      const service = await services!.loadGitHooksService();

      expect(service).toBe(fakeGitHooksService);
    });
  });

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------

  describe('error handling', () => {
    it('propagates errors thrown by Orchestrator.run()', async () => {
      const orchestratorError = new Error('Build infrastructure failure');
      mockOrchestratorRun.mockRejectedValue(orchestratorError);
      installOrchestratorMock();
      const { loadOrchestrator } = await import('./orchestrator-plugin');

      const orchestrator = await loadOrchestrator();

      await expect(orchestrator!.run({}, 'ubuntu:latest')).rejects.toThrow('Build infrastructure failure');
    });

    it('returns undefined services as-is when a service export is undefined', async () => {
      installOrchestratorMock({
        BuildReliabilityService: undefined,
        ChildWorkspaceService: undefined,
      });
      const { loadEnterpriseServices } = await import('./orchestrator-plugin');

      const services = await loadEnterpriseServices();

      expect(services).toBeDefined();
      expect(services!.BuildReliabilityService).toBeUndefined();

      // The lazy loader still works -- it just returns undefined
      const childService = await services!.loadChildWorkspaceService();
      expect(childService).toBeUndefined();
    });
  });
});
