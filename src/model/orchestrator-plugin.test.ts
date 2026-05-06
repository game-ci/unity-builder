/**
 * Compatibility tests for the legacy orchestrator-plugin module name.
 *
 * CI targets this file pattern directly, and consumers may still import this
 * module while migrating to the generic plugin API.
 */

describe('orchestrator-plugin compatibility exports', () => {
  it('keeps loadOrchestratorPlugin as an alias for loadPlugin', async () => {
    const plugin = await import('./plugin');
    const compatibility = await import('./orchestrator-plugin');

    expect(compatibility.loadOrchestratorPlugin).toBe(plugin.loadPlugin);
  });
});
