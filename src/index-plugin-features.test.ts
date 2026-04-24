/**
 * Integration wiring tests for the plugin lifecycle in index.ts
 *
 * These tests verify that:
 * - The plugin lifecycle hooks are called in the correct order
 * - Plugin canHandleBuild() controls the execution path
 * - fallbackToLocal is handled correctly
 * - When no plugin is installed, local builds still work
 * - When providerStrategy is non-local without a plugin, an error is thrown
 */

import { BuildParameters } from './model';

// ---------------------------------------------------------------------------
// Mock plugin
// ---------------------------------------------------------------------------

const mockPlugin = {
  initialize: jest.fn().mockResolvedValue(undefined),
  canHandleBuild: jest.fn().mockReturnValue(false),
  handleBuild: jest.fn().mockResolvedValue({ exitCode: 0 }),
  beforeLocalBuild: jest.fn().mockResolvedValue(undefined),
  afterLocalBuild: jest.fn().mockResolvedValue(undefined),
  handlePostBuild: jest.fn().mockResolvedValue(undefined),
};

const mockLoadOrchestratorPlugin = jest.fn().mockResolvedValue(mockPlugin);

jest.mock('./model/orchestrator-plugin', () => ({
  loadOrchestratorPlugin: mockLoadOrchestratorPlugin,
}));

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

function createMockBuildParameters(overrides: Record<string, any> = {}) {
  return {
    providerStrategy: 'local',
    targetPlatform: 'StandaloneLinux64',
    editorVersion: '2021.3.1f1',
    buildVersion: '1.0.0',
    androidVersionCode: '1',
    projectPath: '.',
    branch: 'main',
    runnerTempPath: '/tmp',
    ...overrides,
  };
}

async function runIndex(overrides: Record<string, any> = {}): Promise<void> {
  mockedBuildParametersCreate.mockResolvedValue(createMockBuildParameters(overrides));

  return new Promise<void>((resolve) => {
    jest.isolateModules(() => {
      require('./index');
    });
    setTimeout(resolve, 100);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('index.ts plugin lifecycle wiring', () => {
  const originalPlatform = process.platform;
  const originalEnvironment = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GITHUB_WORKSPACE = '/workspace';
    Object.defineProperty(process, 'platform', { value: 'linux' });

    // Reset plugin to default behavior
    mockPlugin.canHandleBuild.mockReturnValue(false);
    mockPlugin.handleBuild.mockResolvedValue({ exitCode: 0 });
    mockLoadOrchestratorPlugin.mockResolvedValue(mockPlugin);
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    process.env = { ...originalEnvironment };
  });

  // -----------------------------------------------------------------------
  // Local build with plugin
  // -----------------------------------------------------------------------

  describe('local build with plugin installed', () => {
    it('should call lifecycle hooks in order: initialize → beforeLocalBuild → [build] → afterLocalBuild → handlePostBuild', async () => {
      const callOrder: string[] = [];
      mockPlugin.initialize.mockImplementation(async () => callOrder.push('initialize'));
      mockPlugin.beforeLocalBuild.mockImplementation(async () => callOrder.push('beforeLocalBuild'));
      mockPlugin.afterLocalBuild.mockImplementation(async () => callOrder.push('afterLocalBuild'));
      mockPlugin.handlePostBuild.mockImplementation(async () => callOrder.push('handlePostBuild'));

      await runIndex();

      expect(callOrder).toEqual(['initialize', 'beforeLocalBuild', 'afterLocalBuild', 'handlePostBuild']);
    });

    it('should pass buildParameters and workspace to initialize', async () => {
      await runIndex({ targetPlatform: 'WebGL' });

      expect(mockPlugin.initialize).toHaveBeenCalledWith(
        expect.objectContaining({ targetPlatform: 'WebGL' }),
        '/workspace',
      );
    });

    it('should pass workspace to beforeLocalBuild', async () => {
      await runIndex();

      expect(mockPlugin.beforeLocalBuild).toHaveBeenCalledWith('/workspace');
    });

    it('should pass workspace and exit code to afterLocalBuild', async () => {
      await runIndex();

      expect(mockPlugin.afterLocalBuild).toHaveBeenCalledWith('/workspace', 0);
    });

    it('should pass exit code to handlePostBuild', async () => {
      await runIndex();

      expect(mockPlugin.handlePostBuild).toHaveBeenCalledWith(0);
    });
  });

  // -----------------------------------------------------------------------
  // Plugin handles build entirely
  // -----------------------------------------------------------------------

  describe('plugin handles build (canHandleBuild = true)', () => {
    it('should call handleBuild instead of Docker.run', async () => {
      const { Docker } = require('./model');
      mockPlugin.canHandleBuild.mockReturnValue(true);
      mockPlugin.handleBuild.mockResolvedValue({ exitCode: 0 });

      await runIndex();

      expect(mockPlugin.handleBuild).toHaveBeenCalledWith('mock-image:latest');
      expect(Docker.run).not.toHaveBeenCalled();
      expect(mockPlugin.beforeLocalBuild).not.toHaveBeenCalled();
      expect(mockPlugin.afterLocalBuild).not.toHaveBeenCalled();
    });

    it('should still call handlePostBuild after handleBuild', async () => {
      mockPlugin.canHandleBuild.mockReturnValue(true);
      mockPlugin.handleBuild.mockResolvedValue({ exitCode: 0 });

      await runIndex();

      expect(mockPlugin.handlePostBuild).toHaveBeenCalledWith(0);
    });
  });

  // -----------------------------------------------------------------------
  // Fallback to local
  // -----------------------------------------------------------------------

  describe('fallback to local build', () => {
    it('should do a local build when handleBuild returns fallbackToLocal', async () => {
      const { Docker } = require('./model');
      mockPlugin.canHandleBuild.mockReturnValue(true);
      mockPlugin.handleBuild.mockResolvedValue({ exitCode: -1, fallbackToLocal: true });

      await runIndex();

      expect(mockPlugin.handleBuild).toHaveBeenCalled();
      expect(mockPlugin.beforeLocalBuild).toHaveBeenCalled();
      expect(Docker.run).toHaveBeenCalled();
      expect(mockPlugin.afterLocalBuild).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // No plugin installed
  // -----------------------------------------------------------------------

  describe('no plugin installed', () => {
    it('should build locally without errors when providerStrategy is local', async () => {
      const { Docker } = require('./model');
      mockLoadOrchestratorPlugin.mockResolvedValue(undefined);

      await runIndex({ providerStrategy: 'local' });

      expect(Docker.run).toHaveBeenCalled();
    });

    it('should error when providerStrategy is non-local and no plugin', async () => {
      const core = require('@actions/core');
      mockLoadOrchestratorPlugin.mockResolvedValue(undefined);

      await runIndex({ providerStrategy: 'aws' });

      expect(core.setFailed).toHaveBeenCalledWith(expect.stringContaining('requires @game-ci/orchestrator'));
    });
  });

  // -----------------------------------------------------------------------
  // canHandleBuild = false with non-local provider
  // -----------------------------------------------------------------------

  describe('plugin installed but canHandleBuild returns false with non-local provider', () => {
    it('should error when providerStrategy is non-local', async () => {
      const core = require('@actions/core');
      mockPlugin.canHandleBuild.mockReturnValue(false);

      await runIndex({ providerStrategy: 'aws' });

      // The plugin is initialized but says it can't handle the build,
      // and providerStrategy is not local, so it falls to the error case
      expect(core.setFailed).toHaveBeenCalledWith(expect.stringContaining('requires @game-ci/orchestrator'));
    });
  });
});
