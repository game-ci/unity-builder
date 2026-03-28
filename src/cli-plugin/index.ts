/**
 * @game-ci/orchestrator-plugin
 *
 * CLI plugin adapter for the unity-builder orchestrator.
 * Exports a GameCIPlugin that the CLI consumes via PluginRegistry.
 *
 * Usage in CLI:
 *   import orchestratorPlugin from '@game-ci/orchestrator-plugin';
 *   await PluginRegistry.register(orchestratorPlugin);
 *
 * Or via plugin loader:
 *   await PluginLoader.load('@game-ci/orchestrator-plugin');
 */

import AwsBuildPlatform from '../model/orchestrator/providers/aws';
import Kubernetes from '../model/orchestrator/providers/k8s';
import LocalDockerOrchestrator from '../model/orchestrator/providers/docker';
import LocalOrchestrator from '../model/orchestrator/providers/local';
import TestOrchestrator from '../model/orchestrator/providers/test';
import { configureOrchestratorOptions } from './orchestrator-options-plugin';
import { createProviderAdapter } from './provider-adapter';

/**
 * GameCIPlugin-compatible export.
 *
 * This object matches the GameCIPlugin interface defined in @game-ci/cli:
 * - name, version: plugin metadata
 * - options: registers orchestrator-specific CLI options (aws, k8s, hooks, etc.)
 * - providers: maps strategy names to provider constructors
 */
const orchestratorPlugin = {
  name: 'orchestrator',
  version: '3.0.0',

  /**
   * Options plugins — register orchestrator-specific yargs options.
   * engine: '*' means these options apply regardless of which engine is detected.
   */
  options: [
    {
      engine: '*',
      configure: configureOrchestratorOptions,
    },
  ],

  /**
   * Provider constructors keyed by strategy name.
   * Each is wrapped via createProviderAdapter so the CLI can instantiate them
   * with yargs options (flat key-value) instead of BuildParameters directly.
   */
  providers: {
    aws: createProviderAdapter(AwsBuildPlatform),
    k8s: createProviderAdapter(Kubernetes),
    'local-docker': createProviderAdapter(LocalDockerOrchestrator),
    'local-system': createProviderAdapter(LocalOrchestrator),
    local: createProviderAdapter(LocalOrchestrator),
    test: createProviderAdapter(TestOrchestrator),
  },
};

export default orchestratorPlugin;
export { orchestratorPlugin };
export { createBuildParametersFromCliOptions } from './build-parameters-adapter';
export { configureOrchestratorOptions } from './orchestrator-options-plugin';
export { createProviderAdapter } from './provider-adapter';
