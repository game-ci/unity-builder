/**
 * Tests for the generic plugin loader (plugin.ts).
 *
 * The default plugin implementation is currently @game-ci/orchestrator, but
 * unity-builder depends on the generic Plugin lifecycle rather than an
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

describe('plugin (default package not installed)', () => {
  it('loadPlugin() returns undefined', async () => {
    const { loadPlugin } = await import('./plugin');

    const result = await loadPlugin();

    expect(result).toBeUndefined();
  });
});

describe('plugin (default package installed)', () => {
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
    const { loadPlugin } = await import('./plugin');

    await expect(loadPlugin()).rejects.toThrow('Syntax error in module');
  });
});
