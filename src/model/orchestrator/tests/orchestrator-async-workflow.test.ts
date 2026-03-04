import { BuildParameters, ImageTag } from '../..';
import Orchestrator from '../orchestrator';
import UnityVersioning from '../../unity-versioning';
import { Cli } from '../../cli/cli';
import OrchestratorOptions from '../options/orchestrator-options';
import setups from './orchestrator-suite.test';
import { OptionValues } from 'commander';

async function CreateParameters(overrides: OptionValues | undefined) {
  if (overrides) Cli.options = overrides;

  return BuildParameters.create();
}
describe('Orchestrator Async Workflows', () => {
  setups();
  it('Responds', () => {});

  if (OrchestratorOptions.orchestratorDebug && OrchestratorOptions.providerStrategy !== `local-docker`) {
    it('Async Workflows', async () => {
      // Setup parameters
      const buildParameter = await CreateParameters({
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.read('test-project'),
        asyncOrchestrator: `true`,
        githubChecks: `true`,
        providerStrategy: 'k8s',
        buildPlatform: 'linux',
        targetPlatform: 'StandaloneLinux64',
      });
      const baseImage = new ImageTag(buildParameter);

      // Run the job
      await Orchestrator.run(buildParameter, baseImage.toString());

      // wait for 15 seconds
      await new Promise((resolve) => setTimeout(resolve, 1000 * 60 * 12));
    }, 1_000_000_000);
  }
});
