import { BuildParameters } from '../..';
import CloudRunner from '../cloud-runner';
import UnityVersioning from '../../unity-versioning';
import { Cli } from '../../cli/cli';
import CloudRunnerOptions from '../options/cloud-runner-options';
import setups from './cloud-runner-suite.test';
import { OptionValues } from 'commander';
import GitHub from '../../github';

async function CreateParameters(overrides: OptionValues | undefined) {
  if (overrides) Cli.options = overrides;

  return BuildParameters.create();
}
describe('Cloud Runner Github Checks', () => {
  setups();
  it('Responds', () => {});

  if (CloudRunnerOptions.cloudRunnerDebug && CloudRunnerOptions.providerStrategy === `local-docker`) {
    it('Check Handling Direct', async () => {
      // Setup parameters
      const buildParameter = await CreateParameters({
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.read('test-project'),
        asyncCloudRunner: `true`,
        githubChecks: `true`,
      });
      await CloudRunner.setup(buildParameter);
      CloudRunner.buildParameters.githubCheckId = await GitHub.createGitHubCheck(`t`);
      await GitHub.updateGitHubCheck(`t`, `t2`);
    }, 1_000_000_000);
    it('Check Handling Via Async Workflow', async () => {
      // Setup parameters
      const buildParameter = await CreateParameters({
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.read('test-project'),
        asyncCloudRunner: `true`,
        githubChecks: `true`,
      });
      GitHub.asyncWorkflows = true;
      await CloudRunner.setup(buildParameter);
      CloudRunner.buildParameters.githubCheckId = await GitHub.createGitHubCheck(`t`);
      await GitHub.updateGitHubCheck(`t`, `t2`);
      GitHub.asyncWorkflows = false;
    }, 1_000_000_000);
  }
});
