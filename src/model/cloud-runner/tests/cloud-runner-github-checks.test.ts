import { BuildParameters } from '../..';
import CloudRunner from '../cloud-runner';
import UnityVersioning from '../../unity-versioning';
import { Cli } from '../../cli/cli';
import CloudRunnerOptions from '../options/cloud-runner-options';
import setups from './cloud-runner-suite.test';
import { OptionValues } from 'commander';
import GitHub from '../../github';
export const TIMEOUT_INFINITE = 1e9;
async function CreateParameters(overrides: OptionValues | undefined) {
  if (overrides) Cli.options = overrides;

  return BuildParameters.create();
}
describe('Cloud Runner Github Checks', () => {
  setups();
  it('Responds', () => {});

  if (CloudRunnerOptions.cloudRunnerDebug) {
    it(
      'Check Handling Direct',
      async () => {
        // Setup parameters
        const buildParameter = await CreateParameters({
          versioning: 'None',
          projectPath: 'test-project',
          unityVersion: UnityVersioning.read('test-project'),
          asyncCloudRunner: `true`,
          githubChecks: `true`,
        });
        await CloudRunner.setup(buildParameter);
        CloudRunner.buildParameters.githubCheckId = await GitHub.createGitHubCheck(`direct create`);
        await GitHub.updateGitHubCheck(`1 ${new Date().toISOString()}`, `direct`);
        await GitHub.updateGitHubCheck(`2 ${new Date().toISOString()}`, `direct`, `success`, `completed`);
      },
      TIMEOUT_INFINITE,
    );
    it(
      'Check Handling Via Async Workflow',
      async () => {
        // Setup parameters
        const buildParameter = await CreateParameters({
          versioning: 'None',
          projectPath: 'test-project',
          unityVersion: UnityVersioning.read('test-project'),
          asyncCloudRunner: `true`,
          githubChecks: `true`,
        });
        GitHub.forceAsyncTest = true;
        await CloudRunner.setup(buildParameter);
        CloudRunner.buildParameters.githubCheckId = await GitHub.createGitHubCheck(`async create`);
        await GitHub.updateGitHubCheck(`1 ${new Date().toISOString()}`, `async`);
        await GitHub.updateGitHubCheck(`2 ${new Date().toISOString()}`, `async`, `success`, `completed`);
        GitHub.forceAsyncTest = false;
      },
      TIMEOUT_INFINITE,
    );
  }
});
