/**
 * Tests for the generic build plugin loader (build-plugin.ts).
 *
 * The default plugin implementation is currently @game-ci/orchestrator, but
 * unity-builder depends on the generic BuildPlugin lifecycle rather than an
 * orchestrator-specific type.
 */

const mockWarning = jest.fn();
const mockInfo = jest.fn();
jest.mock('@actions/core', () => ({
  warning: mockWarning,
  info: mockInfo,
}));

beforeEach(() => {
  jest.resetModules();
  mockWarning.mockClear();
  mockInfo.mockClear();
});

describe('build-plugin (default package not installed)', () => {
  it('loadBuildPlugin() returns undefined', async () => {
    const { loadBuildPlugin } = await import('./build-plugin');

    const result = await loadBuildPlugin();

    expect(result).toBeUndefined();
  });
});

describe('build-plugin (default package installed)', () => {
  const fakePlugin = {
    initialize: jest.fn(),
    canHandleBuild: jest.fn().mockReturnValue(false),
    handleBuild: jest.fn().mockResolvedValue({ exitCode: 0 }),
    beforeLocalBuild: jest.fn(),
    afterLocalBuild: jest.fn(),
    handlePostBuild: jest.fn(),
  };

  const mockCreatePlugin = jest.fn().mockReturnValue(fakePlugin);

  function installDefaultPluginMock(overrides: Record<string, unknown> = {}) {
    jest.doMock(
      '@game-ci/orchestrator',
      () => ({
        createPlugin: mockCreatePlugin,
        ...overrides,
      }),
      { virtual: true },
    );
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
    const { loadBuildPlugin } = await import('./build-plugin');

    const plugin = await loadBuildPlugin();

    expect(plugin).toBeDefined();
    expect(mockCreatePlugin).toHaveBeenCalledTimes(1);
    expect(plugin).toBe(fakePlugin);
  });

  it('returns a plugin with all lifecycle methods', async () => {
    installDefaultPluginMock();
    const { loadBuildPlugin } = await import('./build-plugin');

    const plugin = await loadBuildPlugin();

    expect(typeof plugin!.initialize).toBe('function');
    expect(typeof plugin!.canHandleBuild).toBe('function');
    expect(typeof plugin!.handleBuild).toBe('function');
    expect(typeof plugin!.beforeLocalBuild).toBe('function');
    expect(typeof plugin!.afterLocalBuild).toBe('function');
    expect(typeof plugin!.handlePostBuild).toBe('function');
  });

  it('returns undefined and warns when createPlugin is not a function', async () => {
    installDefaultPluginMock({ createPlugin: undefined });
    const { loadBuildPlugin } = await import('./build-plugin');

    const plugin = await loadBuildPlugin();

    expect(plugin).toBeUndefined();
    expect(mockWarning).toHaveBeenCalledWith(expect.stringContaining('does not export createPlugin'));
  });

  it('propagates non-MODULE_NOT_FOUND errors', async () => {
    const importError = new Error('Syntax error in module');
    jest.doMock(
      '@game-ci/orchestrator',
      () => {
        throw importError;
      },
      { virtual: true },
    );
    const { loadBuildPlugin } = await import('./build-plugin');

    await expect(loadBuildPlugin()).rejects.toThrow('Syntax error in module');
  });
});

describe('orchestrator-plugin compatibility exports', () => {
  it('keeps the old loader name as an alias', async () => {
    const buildPlugin = await import('./build-plugin');
    const compatibility = await import('./orchestrator-plugin');

    expect(compatibility.loadOrchestratorPlugin).toBe(buildPlugin.loadBuildPlugin);
  });
});
