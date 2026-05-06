import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
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

import { BuildParameters, Docker } from './model';
import * as core from '@actions/core';

// ---------------------------------------------------------------------------
// Mock plugin
// ---------------------------------------------------------------------------

// `vi.mock` hoists to the top of the module, so any factory references must
// be hoisted with `vi.hoisted` to be defined at mock-evaluation time.
const { mockPlugin, mockLoadPlugin } = vi.hoisted(() => {
  const plugin = {
    initialize: vi.fn().mockResolvedValue(undefined),
    canHandleBuild: vi.fn().mockReturnValue(false),
    handleBuild: vi.fn().mockResolvedValue({ exitCode: 0 }),
    beforeLocalBuild: vi.fn().mockResolvedValue(undefined),
    afterLocalBuild: vi.fn().mockResolvedValue(undefined),
    handlePostBuild: vi.fn().mockResolvedValue(undefined),
  };
  return {
    mockPlugin: plugin,
    mockLoadPlugin: vi.fn().mockResolvedValue(plugin),
  };
});

vi.mock('./model/plugin', () => ({
  loadPlugin: mockLoadPlugin,
}));

vi.mock('@actions/core');
vi.mock('./model', () => ({
  Action: {
    checkCompatibility: vi.fn(),
    workspace: '/workspace',
    actionFolder: '/action',
  },
  BuildParameters: {
    create: vi.fn(),
  },
  Cache: {
    verify: vi.fn(),
  },
  Docker: {
    run: vi.fn().mockResolvedValue(0),
  },
  // vitest 4 requires constructor mocks to use regular `function` (or
  // `class`); arrow fns aren't valid constructors.
  ImageTag: vi.fn(function () {
    return { toString: () => 'mock-image:latest' };
  }),
  Output: {
    setBuildVersion: vi.fn().mockResolvedValue(''),
    setAndroidVersionCode: vi.fn().mockResolvedValue(''),
    setEngineExitCode: vi.fn().mockResolvedValue(''),
  },
}));

vi.mock('./model/cli/cli', () => ({
  Cli: {
    InitCliMode: vi.fn().mockReturnValue(false),
  },
}));

vi.mock('./model/mac-builder', () => ({
  __esModule: true,
  default: {
    run: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock('./model/platform-setup', () => ({
  __esModule: true,
  default: {
    setup: vi.fn().mockResolvedValue(''),
  },
}));

const mockedBuildParametersCreate = BuildParameters.create as Mock;

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

  // index.ts exports `runMain` for testability (the file used to rely on
  // top-level execution + jest's `vi.isolateModules`, but vitest 4 dropped
  // that API). Calling the exported function directly is cleaner than
  // round-tripping through dynamic imports.
  const { runMain } = await import('./index');
  await runMain();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('index.ts plugin lifecycle wiring', () => {
  const originalPlatform = process.platform;
  const originalEnvironment = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_WORKSPACE = '/workspace';
    Object.defineProperty(process, 'platform', { value: 'linux' });

    // Reset plugin to default behavior
    mockPlugin.canHandleBuild.mockReturnValue(false);
    mockPlugin.handleBuild.mockResolvedValue({ exitCode: 0 });
    mockLoadPlugin.mockResolvedValue(mockPlugin);
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    process.env = { ...originalEnvironment };
  });

  // -----------------------------------------------------------------------
  // Local build with plugin
  // -----------------------------------------------------------------------

  describe('local build with plugin installed', () => {
    it('should call lifecycle hooks in order: initialize -> beforeLocalBuild -> [build] -> afterLocalBuild -> handlePostBuild', async () => {
      const callOrder: string[] = [];
      mockPlugin.initialize.mockImplementation(async () => callOrder.push('initialize'));
      mockPlugin.beforeLocalBuild.mockImplementation(async () =>
        callOrder.push('beforeLocalBuild'),
      );
      mockPlugin.afterLocalBuild.mockImplementation(async () => callOrder.push('afterLocalBuild'));
      mockPlugin.handlePostBuild.mockImplementation(async () => callOrder.push('handlePostBuild'));

      await runIndex();

      expect(callOrder).toEqual([
        'initialize',
        'beforeLocalBuild',
        'afterLocalBuild',
        'handlePostBuild',
      ]);
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
      mockLoadPlugin.mockResolvedValue(undefined);

      await runIndex({ providerStrategy: 'local' });

      expect(Docker.run).toHaveBeenCalled();
    });

    it('should error when providerStrategy is non-local and no plugin', async () => {
      mockLoadPlugin.mockResolvedValue(undefined);

      await runIndex({ providerStrategy: 'aws' });

      expect(core.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('requires @game-ci/orchestrator'),
      );
    });
  });

  // -----------------------------------------------------------------------
  // canHandleBuild = false with non-local provider
  // -----------------------------------------------------------------------

  describe('plugin installed but canHandleBuild returns false with non-local provider', () => {
    it('should error when providerStrategy is non-local', async () => {
      mockPlugin.canHandleBuild.mockReturnValue(false);

      await runIndex({ providerStrategy: 'aws' });

      // The plugin is initialized but says it can't handle the build,
      // and providerStrategy is not local, so it falls to the error case
      expect(core.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('requires @game-ci/orchestrator'),
      );
    });
  });
});
