/**
 * Integration wiring tests for plugin features in index.ts
 *
 * These tests verify the conditional gating logic in runMain():
 * - Each plugin feature is only invoked when its gate condition is met
 * - Services are NOT called when their feature is disabled (the default)
 * - The order of operations is correct (restore before build, save after build)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { BuildParameters } from './model';

// ---------------------------------------------------------------------------
// Service mocks — must be declared before importing index.ts (jest hoists them)
// ---------------------------------------------------------------------------

const mockChildWorkspaceService = {
  buildConfig: jest.fn().mockReturnValue({ enabled: true, workspaceName: 'Test' }),
  initializeWorkspace: jest.fn().mockReturnValue(false),
  getWorkspaceSize: jest.fn().mockReturnValue('0 B'),
  saveWorkspace: jest.fn(),
};

const mockSubmoduleProfileService = {
  createInitPlan: jest.fn().mockResolvedValue([]),
  execute: jest.fn().mockResolvedValue(''),
};

const mockLfsAgentService = {
  configure: jest.fn().mockResolvedValue(''),
};

const mockLocalCacheService = {
  resolveCacheRoot: jest.fn().mockReturnValue('/cache'),
  generateCacheKey: jest.fn().mockReturnValue('key-1'),
  restoreLfsCache: jest.fn().mockResolvedValue(true),
  restoreLibraryCache: jest.fn().mockResolvedValue(true),
  saveLibraryCache: jest.fn().mockResolvedValue(''),
  saveLfsCache: jest.fn().mockResolvedValue(''),
};

const mockGitHooksService = {
  installHooks: jest.fn().mockResolvedValue(''),
  configureSkipList: jest.fn().mockReturnValue({ LEFTHOOK_EXCLUDE: 'pre-commit' }),
};

const mockBuildReliabilityService = {
  configureGitEnvironment: jest.fn(),
  checkGitIntegrity: jest.fn().mockReturnValue(true),
  cleanStaleLockFiles: jest.fn(),
  validateSubmoduleBackingStores: jest.fn(),
  cleanReservedFilenames: jest.fn(),
  recoverCorruptedRepo: jest.fn().mockReturnValue(true),
  archiveBuildOutput: jest.fn(),
  enforceRetention: jest.fn(),
};

const mockTestWorkflowService = {
  executeTestSuite: jest.fn().mockResolvedValue([]),
};

const mockHotRunnerService = jest.fn();

const mockIncrementalSyncService = {
  resolveStrategy: jest.fn().mockReturnValue('full'),
  syncGitDelta: jest.fn().mockResolvedValue(0),
  applyDirectInput: jest.fn().mockResolvedValue([]),
  syncStoragePull: jest.fn().mockResolvedValue([]),
  revertOverlays: jest.fn().mockImplementation(() => Promise.resolve()),
};

const mockOutputService = {
  collectOutputs: jest.fn().mockImplementation(() => Promise.resolve()),
};

const mockOutputTypeRegistry = {
  registerType: jest.fn(),
};

const mockArtifactUploadHandler = {
  parseConfig: jest.fn().mockImplementation(() => {
    /* no config */
  }),
  uploadArtifacts: jest.fn().mockResolvedValue({ success: true, entries: [] }),
};

const mockOrchestrator = {
  run: jest.fn().mockImplementation(() => Promise.resolve()),
};

// Mock the orchestrator-plugin module to directly return our mock services.
// This avoids any issues with dynamic imports inside loadPluginServices().
jest.mock('./model/orchestrator-plugin', () => ({
  loadOrchestrator: jest.fn().mockResolvedValue({
    run: mockOrchestrator.run,
  }),
  loadPluginServices: jest.fn().mockResolvedValue({
    BuildReliabilityService: mockBuildReliabilityService,
    TestWorkflowService: mockTestWorkflowService,
    HotRunnerService: mockHotRunnerService,
    OutputService: mockOutputService,
    OutputTypeRegistry: mockOutputTypeRegistry,
    ArtifactUploadHandler: mockArtifactUploadHandler,
    IncrementalSyncService: mockIncrementalSyncService,

    // Lazy-loaded services (matching the plugin loader API)
    loadChildWorkspaceService: jest.fn().mockResolvedValue(mockChildWorkspaceService),
    loadLocalCacheService: jest.fn().mockResolvedValue(mockLocalCacheService),
    loadSubmoduleProfileService: jest.fn().mockResolvedValue(mockSubmoduleProfileService),
    loadLfsAgentService: jest.fn().mockResolvedValue(mockLfsAgentService),
    loadGitHooksService: jest.fn().mockResolvedValue(mockGitHooksService),
  }),
}));

// Mock all non-plugin dependencies to isolate the wiring logic
jest.mock('@actions/core');
jest.mock('./model', () => ({
  Action: {
    checkCompatibility: jest.fn(),
    workspace: '/workspace',
    actionFolder: '/action',
  },
  BuildParameters: {
    create: jest.fn(),
  },
  Cache: {
    verify: jest.fn(),
  },
  Docker: {
    run: jest.fn().mockResolvedValue(0),
  },
  ImageTag: jest.fn().mockImplementation(() => ({
    toString: () => 'mock-image:latest',
  })),
  Output: {
    setBuildVersion: jest.fn().mockResolvedValue(''),
    setAndroidVersionCode: jest.fn().mockResolvedValue(''),
    setEngineExitCode: jest.fn().mockResolvedValue(''),
  },
}));

jest.mock('./model/cli/cli', () => ({
  Cli: {
    InitCliMode: jest.fn().mockReturnValue(false),
  },
}));

jest.mock('./model/mac-builder', () => ({
  __esModule: true,
  default: {
    run: jest.fn().mockResolvedValue(0),
  },
}));

jest.mock('./model/platform-setup', () => ({
  __esModule: true,
  default: {
    setup: jest.fn().mockResolvedValue(''),
  },
}));

const mockedBuildParametersCreate = BuildParameters.create as jest.Mock;

interface PluginBuildParametersOverrides {
  providerStrategy?: string;
  childWorkspacesEnabled?: boolean;
  childWorkspaceName?: string;
  childWorkspaceCacheRoot?: string;
  childWorkspacePreserveGit?: boolean;
  childWorkspaceSeparateLibrary?: boolean;
  submoduleProfilePath?: string;
  submoduleVariantPath?: string;
  submoduleToken?: string;
  gitPrivateToken?: string;
  lfsTransferAgent?: string;
  lfsTransferAgentArgs?: string;
  lfsStoragePaths?: string;
  localCacheEnabled?: boolean;
  localCacheRoot?: string;
  localCacheLibrary?: boolean;
  localCacheLfs?: boolean;
  gitHooksEnabled?: boolean;
  gitHooksSkipList?: string;
  gitHooksRunBeforeBuild?: string;
}

function createMockBuildParameters(overrides: PluginBuildParametersOverrides = {}) {
  return {
    // Required base properties
    providerStrategy: 'local',
    targetPlatform: 'StandaloneLinux64',
    editorVersion: '2021.3.1f1',
    buildVersion: '1.0.0',
    androidVersionCode: '1',
    projectPath: '.',
    branch: 'main',
    runnerTempPath: '/tmp',

    // Plugin features - all disabled by default
    childWorkspacesEnabled: false,
    childWorkspaceName: '',
    childWorkspaceCacheRoot: '',
    childWorkspacePreserveGit: true,
    childWorkspaceSeparateLibrary: true,
    submoduleProfilePath: '',
    submoduleVariantPath: '',
    submoduleToken: '',
    gitPrivateToken: '',
    lfsTransferAgent: '',
    lfsTransferAgentArgs: '',
    lfsStoragePaths: '',
    localCacheEnabled: false,
    localCacheRoot: '',
    localCacheLibrary: true,
    localCacheLfs: false,
    gitHooksEnabled: false,
    gitHooksSkipList: '',
    gitHooksRunBeforeBuild: '',

    ...overrides,
  };
}

/**
 * The entry point (runMain) is invoked by importing index.ts.
 * Since it calls `runMain()` at module scope, we need to re-import it
 * for each test. jest.isolateModules() handles this.
 */
async function runIndex(overrides: PluginBuildParametersOverrides = {}): Promise<void> {
  mockedBuildParametersCreate.mockResolvedValue(createMockBuildParameters(overrides));

  return new Promise<void>((resolve) => {
    jest.isolateModules(() => {
      require('./index');

      // runMain() is async; give it a tick to complete
      // We use setImmediate to ensure all microtasks from the dynamic imports resolve
    });

    // Allow all promises and microtasks to settle
    setTimeout(resolve, 100);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('index.ts plugin feature wiring', () => {
  const originalPlatform = process.platform;
  const originalEnvironment = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GITHUB_WORKSPACE = '/workspace';

    // Force linux platform so Docker.run is used (not MacBuilder)
    Object.defineProperty(process, 'platform', { value: 'linux' });
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    process.env = { ...originalEnvironment };
  });

  // -----------------------------------------------------------------------
  // GitHooksService gating
  // -----------------------------------------------------------------------

  describe('GitHooksService gating', () => {
    it('should NOT call GitHooksService when gitHooksEnabled is false (default)', async () => {
      await runIndex({ gitHooksEnabled: false });

      expect(mockGitHooksService.installHooks).not.toHaveBeenCalled();
      expect(mockGitHooksService.configureSkipList).not.toHaveBeenCalled();
    });

    it('should call installHooks when gitHooksEnabled is true', async () => {
      await runIndex({ gitHooksEnabled: true });

      expect(mockGitHooksService.installHooks).toHaveBeenCalledWith('/workspace');
    });

    it('should call configureSkipList when gitHooksEnabled and gitHooksSkipList is set', async () => {
      await runIndex({
        gitHooksEnabled: true,
        gitHooksSkipList: 'pre-commit,pre-push',
      });

      expect(mockGitHooksService.configureSkipList).toHaveBeenCalledWith(['pre-commit', 'pre-push']);
    });

    it('should NOT call configureSkipList when gitHooksSkipList is empty', async () => {
      await runIndex({
        gitHooksEnabled: true,
        gitHooksSkipList: '',
      });

      expect(mockGitHooksService.installHooks).toHaveBeenCalled();
      expect(mockGitHooksService.configureSkipList).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // LocalCacheService gating
  // -----------------------------------------------------------------------

  describe('LocalCacheService gating', () => {
    it('should NOT call LocalCacheService when localCacheEnabled is false (default)', async () => {
      await runIndex({ localCacheEnabled: false });

      expect(mockLocalCacheService.resolveCacheRoot).not.toHaveBeenCalled();
      expect(mockLocalCacheService.generateCacheKey).not.toHaveBeenCalled();
      expect(mockLocalCacheService.restoreLibraryCache).not.toHaveBeenCalled();
      expect(mockLocalCacheService.restoreLfsCache).not.toHaveBeenCalled();
      expect(mockLocalCacheService.saveLibraryCache).not.toHaveBeenCalled();
      expect(mockLocalCacheService.saveLfsCache).not.toHaveBeenCalled();
    });

    it('should call restore and save operations when localCacheEnabled is true', async () => {
      await runIndex({
        localCacheEnabled: true,
        localCacheLibrary: true,
        localCacheLfs: true,
      });

      expect(mockLocalCacheService.resolveCacheRoot).toHaveBeenCalled();
      expect(mockLocalCacheService.generateCacheKey).toHaveBeenCalled();
      expect(mockLocalCacheService.restoreLibraryCache).toHaveBeenCalled();
      expect(mockLocalCacheService.restoreLfsCache).toHaveBeenCalled();
      expect(mockLocalCacheService.saveLibraryCache).toHaveBeenCalled();
      expect(mockLocalCacheService.saveLfsCache).toHaveBeenCalled();
    });

    it('should only cache Library when localCacheLibrary is true and localCacheLfs is false', async () => {
      await runIndex({
        localCacheEnabled: true,
        localCacheLibrary: true,
        localCacheLfs: false,
      });

      expect(mockLocalCacheService.restoreLibraryCache).toHaveBeenCalled();
      expect(mockLocalCacheService.restoreLfsCache).not.toHaveBeenCalled();
      expect(mockLocalCacheService.saveLibraryCache).toHaveBeenCalled();
      expect(mockLocalCacheService.saveLfsCache).not.toHaveBeenCalled();
    });

    it('should only cache LFS when localCacheLfs is true and localCacheLibrary is false', async () => {
      await runIndex({
        localCacheEnabled: true,
        localCacheLibrary: false,
        localCacheLfs: true,
      });

      expect(mockLocalCacheService.restoreLibraryCache).not.toHaveBeenCalled();
      expect(mockLocalCacheService.restoreLfsCache).toHaveBeenCalled();
      expect(mockLocalCacheService.saveLibraryCache).not.toHaveBeenCalled();
      expect(mockLocalCacheService.saveLfsCache).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // ChildWorkspaceService gating
  // -----------------------------------------------------------------------

  describe('ChildWorkspaceService gating', () => {
    it('should NOT call ChildWorkspaceService when childWorkspacesEnabled is false (default)', async () => {
      await runIndex({ childWorkspacesEnabled: false });

      expect(mockChildWorkspaceService.buildConfig).not.toHaveBeenCalled();
      expect(mockChildWorkspaceService.initializeWorkspace).not.toHaveBeenCalled();
      expect(mockChildWorkspaceService.saveWorkspace).not.toHaveBeenCalled();
    });

    it('should NOT call ChildWorkspaceService when childWorkspacesEnabled is true but childWorkspaceName is empty', async () => {
      await runIndex({
        childWorkspacesEnabled: true,
        childWorkspaceName: '',
      });

      expect(mockChildWorkspaceService.buildConfig).not.toHaveBeenCalled();
    });

    it('should call buildConfig, initializeWorkspace, and saveWorkspace when enabled with a name', async () => {
      mockChildWorkspaceService.buildConfig.mockReturnValue({ enabled: true, workspaceName: 'TurnOfWar' });

      await runIndex({
        childWorkspacesEnabled: true,
        childWorkspaceName: 'TurnOfWar',
        childWorkspaceCacheRoot: '/cache/workspaces',
      });

      expect(mockChildWorkspaceService.buildConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          childWorkspacesEnabled: true,
          childWorkspaceName: 'TurnOfWar',
        }),
      );
      expect(mockChildWorkspaceService.initializeWorkspace).toHaveBeenCalled();
      expect(mockChildWorkspaceService.getWorkspaceSize).toHaveBeenCalled();
      expect(mockChildWorkspaceService.saveWorkspace).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // SubmoduleProfileService gating
  // -----------------------------------------------------------------------

  describe('SubmoduleProfileService gating', () => {
    it('should NOT call SubmoduleProfileService when submoduleProfilePath is empty (default)', async () => {
      await runIndex({ submoduleProfilePath: '' });

      expect(mockSubmoduleProfileService.createInitPlan).not.toHaveBeenCalled();
      expect(mockSubmoduleProfileService.execute).not.toHaveBeenCalled();
    });

    it('should call createInitPlan and execute when submoduleProfilePath is set', async () => {
      await runIndex({
        submoduleProfilePath: '/path/to/profile.yml',
        submoduleVariantPath: '',
        submoduleToken: 'my-token',
      });

      expect(mockSubmoduleProfileService.createInitPlan).toHaveBeenCalledWith('/path/to/profile.yml', '', '/workspace');
      expect(mockSubmoduleProfileService.execute).toHaveBeenCalled();
    });

    it('should pass variant path when provided', async () => {
      await runIndex({
        submoduleProfilePath: '/path/to/profile.yml',
        submoduleVariantPath: '/path/to/variant.yml',
      });

      expect(mockSubmoduleProfileService.createInitPlan).toHaveBeenCalledWith(
        '/path/to/profile.yml',
        '/path/to/variant.yml',
        '/workspace',
      );
    });

    it('should use submoduleToken for auth, falling back to gitPrivateToken', async () => {
      await runIndex({
        submoduleProfilePath: '/path/to/profile.yml',
        submoduleToken: '',
        gitPrivateToken: 'fallback-token',
      });

      expect(mockSubmoduleProfileService.execute).toHaveBeenCalledWith(
        expect.anything(),
        '/workspace',
        'fallback-token',
      );
    });

    it('should prefer submoduleToken over gitPrivateToken', async () => {
      await runIndex({
        submoduleProfilePath: '/path/to/profile.yml',
        submoduleToken: 'specific-token',
        gitPrivateToken: 'fallback-token',
      });

      expect(mockSubmoduleProfileService.execute).toHaveBeenCalledWith(
        expect.anything(),
        '/workspace',
        'specific-token',
      );
    });
  });

  // -----------------------------------------------------------------------
  // LfsAgentService gating
  // -----------------------------------------------------------------------

  describe('LfsAgentService gating', () => {
    it('should NOT call LfsAgentService when lfsTransferAgent is empty (default)', async () => {
      await runIndex({ lfsTransferAgent: '' });

      expect(mockLfsAgentService.configure).not.toHaveBeenCalled();
    });

    it('should call configure when lfsTransferAgent is set', async () => {
      await runIndex({
        lfsTransferAgent: '/tools/elastic-git-storage',
        lfsTransferAgentArgs: '--verbose',
        lfsStoragePaths: '/path/a;/path/b',
      });

      expect(mockLfsAgentService.configure).toHaveBeenCalledWith(
        '/tools/elastic-git-storage',
        '--verbose',
        ['/path/a', '/path/b'],
        '/workspace',
      );
    });

    it('should pass empty array when lfsStoragePaths is empty', async () => {
      await runIndex({
        lfsTransferAgent: '/tools/agent',
        lfsStoragePaths: '',
      });

      expect(mockLfsAgentService.configure).toHaveBeenCalledWith('/tools/agent', '', [], '/workspace');
    });
  });

  // -----------------------------------------------------------------------
  // Order of operations (restore before build, save after build)
  // -----------------------------------------------------------------------

  describe('order of operations', () => {
    it('should execute restore operations before build and save operations after build', async () => {
      const callOrder: string[] = [];

      // Track call order for each relevant operation
      mockChildWorkspaceService.buildConfig.mockReturnValue({ enabled: true, workspaceName: 'Test' });
      mockChildWorkspaceService.initializeWorkspace.mockImplementation(() => {
        callOrder.push('child-workspace-restore');

        return false;
      });
      mockChildWorkspaceService.getWorkspaceSize.mockImplementation(() => {
        callOrder.push('child-workspace-size');

        return '0 B';
      });
      mockSubmoduleProfileService.createInitPlan.mockImplementation(async () => {
        callOrder.push('submodule-profile-plan');

        return [];
      });
      mockSubmoduleProfileService.execute.mockImplementation(async () => {
        callOrder.push('submodule-profile-execute');
      });
      mockLfsAgentService.configure.mockImplementation(async () => {
        callOrder.push('lfs-agent-configure');
      });
      mockLocalCacheService.resolveCacheRoot.mockImplementation(() => {
        callOrder.push('local-cache-resolve');

        return '/cache';
      });
      mockLocalCacheService.generateCacheKey.mockImplementation(() => {
        callOrder.push('local-cache-keygen');

        return 'key-1';
      });
      mockLocalCacheService.restoreLfsCache.mockImplementation(async () => {
        callOrder.push('local-cache-restore-lfs');

        return true;
      });
      mockLocalCacheService.restoreLibraryCache.mockImplementation(async () => {
        callOrder.push('local-cache-restore-library');

        return true;
      });
      mockGitHooksService.installHooks.mockImplementation(async () => {
        callOrder.push('git-hooks-install');
      });
      mockLocalCacheService.saveLibraryCache.mockImplementation(async () => {
        callOrder.push('local-cache-save-library');
      });
      mockLocalCacheService.saveLfsCache.mockImplementation(async () => {
        callOrder.push('local-cache-save-lfs');
      });
      mockChildWorkspaceService.saveWorkspace.mockImplementation(() => {
        callOrder.push('child-workspace-save');
      });

      await runIndex({
        childWorkspacesEnabled: true,
        childWorkspaceName: 'TurnOfWar',
        submoduleProfilePath: '/profile.yml',
        lfsTransferAgent: '/tools/agent',
        localCacheEnabled: true,
        localCacheLfs: true,
        localCacheLibrary: true,
        gitHooksEnabled: true,
      });

      // Verify restore operations happen before save operations.
      // The expected order from index.ts is:
      // 1. Child workspace restore
      // 2. Submodule profile init
      // 3. LFS agent configure
      // 4. Local cache restore (LFS then Library)
      // 5. Git hooks install
      // 6. [BUILD happens here - Docker.run or MacBuilder.run]
      // 7. Local cache save (Library then LFS)
      // 8. Child workspace save

      const restoreOps = [
        'child-workspace-restore',
        'submodule-profile-plan',
        'submodule-profile-execute',
        'lfs-agent-configure',
        'local-cache-restore-lfs',
        'local-cache-restore-library',
        'git-hooks-install',
      ];

      const saveOps = ['local-cache-save-library', 'local-cache-save-lfs', 'child-workspace-save'];

      // All restore ops should appear before all save ops
      for (const restoreOp of restoreOps) {
        if (!callOrder.includes(restoreOp)) continue; // Skip if the operation wasn't called
        for (const saveOp of saveOps) {
          if (!callOrder.includes(saveOp)) continue;
          expect(callOrder.indexOf(restoreOp)).toBeLessThan(callOrder.indexOf(saveOp));
        }
      }

      // Child workspace save should be last
      if (callOrder.includes('child-workspace-save') && callOrder.includes('local-cache-save-lfs')) {
        expect(callOrder.indexOf('local-cache-save-lfs')).toBeLessThan(callOrder.indexOf('child-workspace-save'));
      }
    });
  });

  // -----------------------------------------------------------------------
  // Non-local provider strategy
  // -----------------------------------------------------------------------

  describe('non-local provider strategy', () => {
    it('should skip all plugin features when providerStrategy is not local', async () => {
      await runIndex({
        providerStrategy: 'aws',
        childWorkspacesEnabled: true,
        childWorkspaceName: 'Test',
        submoduleProfilePath: '/profile.yml',
        lfsTransferAgent: '/tools/agent',
        localCacheEnabled: true,
        gitHooksEnabled: true,
      });

      // None of the plugin services should be called because
      // they are inside the `if (providerStrategy === 'local')` block
      expect(mockChildWorkspaceService.buildConfig).not.toHaveBeenCalled();
      expect(mockSubmoduleProfileService.createInitPlan).not.toHaveBeenCalled();
      expect(mockLfsAgentService.configure).not.toHaveBeenCalled();
      expect(mockLocalCacheService.resolveCacheRoot).not.toHaveBeenCalled();
      expect(mockGitHooksService.installHooks).not.toHaveBeenCalled();
    });
  });
});
