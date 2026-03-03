import Orchestrator from '../orchestrator';
import UnityVersioning from '../../unity-versioning';
import setups from './orchestrator-suite.test';
import GitHub from '../../github';
import { TIMEOUT_INFINITE, createParameters } from '../../../test-utils/orchestrator-test-helpers';
describe('Orchestrator Github Checks', () => {
  setups();
  it('Responds', () => {});

  beforeEach(() => {
    // Mock GitHub API requests to avoid real network calls
    jest.spyOn(GitHub as any, 'createGitHubCheckRequest').mockResolvedValue({
      status: 201,
      data: { id: '1' },
    });
    jest.spyOn(GitHub as any, 'updateGitHubCheckRequest').mockResolvedValue({
      status: 200,
      data: {},
    });
    // eslint-disable-next-line unicorn/no-useless-undefined
    jest.spyOn(GitHub as any, 'runUpdateAsyncChecksWorkflow').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it(
    'Check Handling Direct',
    async () => {
      // Setup parameters
      const buildParameter = await createParameters({
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.read('test-project'),
        asyncOrchestrator: `true`,
        githubChecks: `true`,
      });
      await Orchestrator.setup(buildParameter);
      Orchestrator.buildParameters.githubCheckId = await GitHub.createGitHubCheck(`direct create`);
      await GitHub.updateGitHubCheck(`1 ${new Date().toISOString()}`, `direct`);
      await GitHub.updateGitHubCheck(`2 ${new Date().toISOString()}`, `direct`, `success`, `completed`);
    },
    TIMEOUT_INFINITE,
  );
  it(
    'Check Handling Via Async Workflow',
    async () => {
      // Setup parameters
      const buildParameter = await createParameters({
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.read('test-project'),
        asyncOrchestrator: `true`,
        githubChecks: `true`,
      });
      GitHub.forceAsyncTest = true;
      await Orchestrator.setup(buildParameter);
      Orchestrator.buildParameters.githubCheckId = await GitHub.createGitHubCheck(`async create`);
      await GitHub.updateGitHubCheck(`1 ${new Date().toISOString()}`, `async`);
      await GitHub.updateGitHubCheck(`2 ${new Date().toISOString()}`, `async`, `success`, `completed`);
      GitHub.forceAsyncTest = false;
    },
    TIMEOUT_INFINITE,
  );
});
