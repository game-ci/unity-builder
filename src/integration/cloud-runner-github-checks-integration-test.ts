// Integration test for exercising real GitHub check creation and updates.
import { BuildParameters } from '../model';
import CloudRunner from '../model/cloud-runner/cloud-runner';
import UnityVersioning from '../model/unity-versioning';
import { Cli } from '../model/cli/cli';
import GitHub from '../model/github';
import { OptionValues } from 'commander';

export const TIMEOUT_INFINITE = 1e9;

async function createParameters(overrides?: OptionValues) {
  if (overrides) Cli.options = overrides;

  return BuildParameters.create();
}

const runIntegration = process.env.RUN_GITHUB_INTEGRATION_TESTS === 'true';
const describeOrSkip = runIntegration ? describe : describe.skip;

describeOrSkip('Cloud Runner Github Checks Integration', () => {
  it(
    'creates and updates a real GitHub check',
    async () => {
      const buildParameter = await createParameters({
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.read('test-project'),
        asyncCloudRunner: `true`,
        githubChecks: `true`,
      });
      await CloudRunner.setup(buildParameter);
      const checkId = await GitHub.createGitHubCheck(`integration create`);
      expect(checkId).not.toEqual('');
      await GitHub.updateGitHubCheck(`1 ${new Date().toISOString()}`, `integration`);
      await GitHub.updateGitHubCheck(`2 ${new Date().toISOString()}`, `integration`, `success`, `completed`);
    },
    TIMEOUT_INFINITE,
  );
});
