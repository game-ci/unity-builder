/**
 * Tests for the orchestrator plugin loader (orchestrator-plugin.ts).
 *
 * The plugin loader dynamically imports @game-ci/orchestrator and calls
 * createPlugin(). Two scenarios:
 *
 * 1. Package NOT installed — loadOrchestratorPlugin() returns undefined.
 * 2. Package IS installed — returns the plugin from createPlugin().
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

// ---------------------------------------------------------------------------
// Part 1: Package NOT installed
// ---------------------------------------------------------------------------

describe('orchestrator-plugin (package not installed)', () => {
  it('loadOrchestratorPlugin() returns undefined', async () => {
    const { loadOrchestratorPlugin } = await import('./orchestrator-plugin');

    const result = await loadOrchestratorPlugin();

    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Part 2: Package IS installed (mocked)
// ---------------------------------------------------------------------------

describe('orchestrator-plugin (package installed)', () => {
  const fakePlugin = {
    initialize: jest.fn(),
    canHandleBuild: jest.fn().mockReturnValue(false),
    handleBuild: jest.fn().mockResolvedValue({ exitCode: 0 }),
    beforeLocalBuild: jest.fn(),
    afterLocalBuild: jest.fn(),
    handlePostBuild: jest.fn(),
  };

  const mockCreatePlugin = jest.fn().mockReturnValue(fakePlugin);

  function installOrchestratorMock(overrides: Record<string, unknown> = {}) {
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
    installOrchestratorMock();
    const { loadOrchestratorPlugin } = await import('./orchestrator-plugin');

    const plugin = await loadOrchestratorPlugin();

    expect(plugin).toBeDefined();
    expect(mockCreatePlugin).toHaveBeenCalledTimes(1);
    expect(plugin).toBe(fakePlugin);
  });

  it('returns the plugin with all lifecycle methods', async () => {
    installOrchestratorMock();
    const { loadOrchestratorPlugin } = await import('./orchestrator-plugin');

    const plugin = await loadOrchestratorPlugin();

    expect(typeof plugin!.initialize).toBe('function');
    expect(typeof plugin!.canHandleBuild).toBe('function');
    expect(typeof plugin!.handleBuild).toBe('function');
    expect(typeof plugin!.beforeLocalBuild).toBe('function');
    expect(typeof plugin!.afterLocalBuild).toBe('function');
    expect(typeof plugin!.handlePostBuild).toBe('function');
  });

  it('returns undefined and warns when createPlugin is not a function', async () => {
    installOrchestratorMock({ createPlugin: undefined });
    const { loadOrchestratorPlugin } = await import('./orchestrator-plugin');

    const plugin = await loadOrchestratorPlugin();

    expect(plugin).toBeUndefined();
    expect(mockWarning).toHaveBeenCalledWith(expect.stringContaining('does not export createPlugin'));
  });

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------

  describe('error handling', () => {
    it('propagates non-MODULE_NOT_FOUND errors', async () => {
      const importError = new Error('Syntax error in module');
      jest.doMock(
        '@game-ci/orchestrator',
        () => {
          throw importError;
        },
        { virtual: true },
      );
      const { loadOrchestratorPlugin } = await import('./orchestrator-plugin');

      await expect(loadOrchestratorPlugin()).rejects.toThrow('Syntax error in module');
    });
  });
});
