// Integration test for exercising real GitHub check creation and updates.
import Orchestrator from '../model/orchestrator/orchestrator';
import UnityVersioning from '../model/unity-versioning';
import GitHub from '../model/github';
import { TIMEOUT_INFINITE, createParameters } from '../test-utils/orchestrator-test-helpers';

const runIntegration = process.env.RUN_GITHUB_INTEGRATION_TESTS === 'true';
const describeOrSkip = runIntegration ? describe : describe.skip;

describeOrSkip('Orchestrator Github Checks Integration', () => {
  it(
    'creates and updates a real GitHub check',
    async () => {
      const buildParameter = await createParameters({
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.read('test-project'),
        asyncOrchestrator: `true`,
        githubChecks: `true`,
      });
      await Orchestrator.setup(buildParameter);
      const checkId = await GitHub.createGitHubCheck(`integration create`);
      expect(checkId).not.toEqual('');
      await GitHub.updateGitHubCheck(`1 ${new Date().toISOString()}`, `integration`);
      await GitHub.updateGitHubCheck(`2 ${new Date().toISOString()}`, `integration`, `success`, `completed`);
    },
    TIMEOUT_INFINITE,
  );
});
