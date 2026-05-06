import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for the generic plugin loader (plugin.ts).
 *
 * The default plugin implementation is currently @game-ci/orchestrator, but
 * unity-builder depends on the generic Plugin lifecycle rather than an
 * orchestrator-specific type.
 */

const mockWarning = vi.fn();
const mockInfo = vi.fn();
vi.mock('@actions/core', () => ({
  warning: mockWarning,
  info: mockInfo,
}));

beforeEach(() => {
  vi.resetModules();
  mockWarning.mockClear();
  mockInfo.mockClear();
});

describe('plugin (default package not installed)', () => {
  it('loadPlugin() returns undefined', async () => {
    const { loadPlugin } = await import('./plugin');

    const result = await loadPlugin();

    expect(result).toBeUndefined();
  });
});

describe('plugin (default package installed)', () => {
  const fakePlugin = {
    initialize: vi.fn(),
    canHandleBuild: vi.fn().mockReturnValue(false),
    handleBuild: vi.fn().mockResolvedValue({ exitCode: 0 }),
    beforeLocalBuild: vi.fn(),
    afterLocalBuild: vi.fn(),
    handlePostBuild: vi.fn(),
  };

  const mockCreatePlugin = vi.fn().mockReturnValue(fakePlugin);

  function installDefaultPluginMock(overrides: Record<string, unknown> = {}) {
    // The `@game-ci/orchestrator` module is intentionally optional and may not
    // be installed. `vi.doMock` lets the dynamic import in the loader resolve
    // through this factory before vite tries to load a real package.
    vi.doMock('@game-ci/orchestrator', () => ({
      createPlugin: mockCreatePlugin,
      ...overrides,
    }));
  }

  beforeEach(() => {
    mockCreatePlugin.mockClear();
    fakePlugin.initialize.mockClear();
    fakePlugin.canHandleBuild.mockClear();
    fakePlugin.handleBuild.mockClear();
    fakePlugin.beforeLocalBuild.mockClear();
    fakePlugin.afterLocalBuild.mockClear();
    fakePlugin.handlePostBuild.mockClear();
  });

  it('returns the plugin from createPlugin()', async () => {
    installDefaultPluginMock();
    const { loadPlugin } = await import('./plugin');

    const plugin = await loadPlugin();

    expect(plugin).toBeDefined();
    expect(mockCreatePlugin).toHaveBeenCalledTimes(1);
    expect(plugin).toBe(fakePlugin);
  });

  it('returns a plugin with all lifecycle methods', async () => {
    installDefaultPluginMock();
    const { loadPlugin } = await import('./plugin');

    const plugin = await loadPlugin();

    expect(typeof plugin!.initialize).toBe('function');
    expect(typeof plugin!.canHandleBuild).toBe('function');
    expect(typeof plugin!.handleBuild).toBe('function');
    expect(typeof plugin!.beforeLocalBuild).toBe('function');
    expect(typeof plugin!.afterLocalBuild).toBe('function');
    expect(typeof plugin!.handlePostBuild).toBe('function');
  });

  it('returns undefined and warns when createPlugin is not a function', async () => {
    installDefaultPluginMock({ createPlugin: undefined });
    const { loadPlugin } = await import('./plugin');

    const plugin = await loadPlugin();

    expect(plugin).toBeUndefined();
    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringContaining('does not export createPlugin'),
    );
  });

  it('propagates non-MODULE_NOT_FOUND errors', async () => {
    // Throw lazily from `createPlugin` rather than from the mock factory
    // itself: vitest 4 wraps factory-time errors with its own message, which
    // masks the inner error at the assertion site.
    installDefaultPluginMock({
      createPlugin: () => {
        throw new Error('Syntax error in module');
      },
    });
    const { loadPlugin } = await import('./plugin');

    await expect(loadPlugin()).rejects.toThrow('Syntax error in module');
  });
});
