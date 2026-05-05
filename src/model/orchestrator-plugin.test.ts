/**
 * Compatibility tests for the legacy orchestrator-plugin module name.
 *
 * CI targets this file pattern directly, and consumers may still import this
 * module while migrating to the generic build-plugin API.
 */

describe('orchestrator-plugin compatibility exports', () => {
  it('keeps loadOrchestratorPlugin as an alias for loadBuildPlugin', async () => {
    const buildPlugin = await import('./build-plugin');
    const compatibility = await import('./orchestrator-plugin');

    expect(compatibility.loadOrchestratorPlugin).toBe(buildPlugin.loadBuildPlugin);
  });
});
