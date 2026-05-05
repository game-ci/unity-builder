import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
/**
 * Tests for the orchestrator plugin loader (orchestrator-plugin.ts).
 *
 * The plugin loader dynamically imports @game-ci/orchestrator and calls
 * createPlugin(). Two scenarios:
 *
 * 1. Package NOT installed — loadOrchestratorPlugin() returns undefined.
 * 2. Package IS installed — returns the plugin from createPlugin().
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
    initialize: vi.fn(),
    canHandleBuild: vi.fn().mockReturnValue(false),
    handleBuild: vi.fn().mockResolvedValue({ exitCode: 0 }),
    beforeLocalBuild: vi.fn(),
    afterLocalBuild: vi.fn(),
    handlePostBuild: vi.fn(),
  };

  const mockCreatePlugin = vi.fn().mockReturnValue(fakePlugin);

  function installOrchestratorMock(overrides: Record<string, unknown> = {}) {
    // vitest 4 doesn't accept jest's `{ virtual: true }` option; the
    // `@game-ci/orchestrator` module is intentionally not installed and is
    // resolved through the vitest test resolver. The `await import(...)` in
    // the consumer code will hit this mock factory before vite tries to
    // resolve the real package.
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
    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringContaining('does not export createPlugin'),
    );
  });

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------

  describe('error handling', () => {
    it('propagates non-MODULE_NOT_FOUND errors', async () => {
      // Throw lazily from `createPlugin` rather than from the mock factory
      // itself: vitest 4 wraps factory-time errors with its own message,
      // which masks the inner error at the assertion site. The plugin
      // loader's contract is still tested — a non-ENOENT error from the
      // dynamic import must surface, not be swallowed.
      installOrchestratorMock({
        createPlugin: () => {
          throw new Error('Syntax error in module');
        },
      });
      const { loadOrchestratorPlugin } = await import('./orchestrator-plugin');

      await expect(loadOrchestratorPlugin()).rejects.toThrow('Syntax error in module');
    });
  });
});
