import SharedWorkspaceLocking from '../services/shared-workspace-locking';
import { Cli } from '../../cli/cli';
import setups from './cloud-runner-suite.test';
import CloudRunnerLogger from '../services/cloud-runner-logger';
import { v4 as uuidv4 } from 'uuid';
import CloudRunnerOptions from '../cloud-runner-options';
import UnityVersioning from '../../unity-versioning';
import BuildParameters from '../../build-parameters';
import CloudRunner from '../cloud-runner';

async function CreateParameters(overrides) {
  if (overrides) {
    Cli.options = overrides;
  }

  return await BuildParameters.create();
}

describe('Cloud Runner Locking', () => {
  setups();
  it('Responds', () => {});
  if (CloudRunnerOptions.cloudRunnerDebug) {
    it(`Simple Locking Flow`, async () => {
      Cli.options.retainWorkspaces = true;
      const overrides: any = {
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.determineUnityVersion('test-project', UnityVersioning.read('test-project')),
        targetPlatform: 'StandaloneLinux64',
        cacheKey: `test-case-${uuidv4()}`,
      };
      const buildParameters = await CreateParameters(overrides);

      const newWorkspaceName = `test-workspace-${uuidv4()}`;
      const runId = uuidv4();
      CloudRunner.buildParameters = buildParameters;
      await SharedWorkspaceLocking.CreateWorkspace(newWorkspaceName, buildParameters);
      const isExpectedUnlockedBeforeLocking =
        (await SharedWorkspaceLocking.IsWorkspaceLocked(newWorkspaceName, buildParameters)) === false;
      expect(isExpectedUnlockedBeforeLocking).toBeTruthy();
      await SharedWorkspaceLocking.LockWorkspace(newWorkspaceName, runId, buildParameters);
      const isExpectedLockedAfterLocking =
        (await SharedWorkspaceLocking.IsWorkspaceLocked(newWorkspaceName, buildParameters)) === true;
      expect(isExpectedLockedAfterLocking).toBeTruthy();
      const locksBeforeRelease = await SharedWorkspaceLocking.GetAllLocks(newWorkspaceName, buildParameters);
      CloudRunnerLogger.log(JSON.stringify(locksBeforeRelease, undefined, 4));
      expect(locksBeforeRelease.length).toBe(1);
      await SharedWorkspaceLocking.ReleaseWorkspace(newWorkspaceName, runId, buildParameters);
      const locks = await SharedWorkspaceLocking.GetAllLocks(newWorkspaceName, buildParameters);
      expect(locks.length).toBe(0);
      const isExpectedLockedAfterReleasing =
        (await SharedWorkspaceLocking.IsWorkspaceLocked(newWorkspaceName, buildParameters)) === false;
      expect(isExpectedLockedAfterReleasing).toBeTruthy();
    }, 150000);
    it.skip('All Locking Actions', async () => {
      Cli.options.retainWorkspaces = true;
      const overrides: any = {
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.determineUnityVersion('test-project', UnityVersioning.read('test-project')),
        targetPlatform: 'StandaloneLinux64',
        cacheKey: `test-case-${uuidv4()}`,
      };
      const buildParameters = await CreateParameters(overrides);

      CloudRunnerLogger.log(
        `GetAllWorkspaces ${JSON.stringify(await SharedWorkspaceLocking.GetAllWorkspaces(buildParameters))}`,
      );
      CloudRunnerLogger.log(
        `GetFreeWorkspaces ${JSON.stringify(await SharedWorkspaceLocking.GetFreeWorkspaces(buildParameters))}`,
      );
      CloudRunnerLogger.log(
        `IsWorkspaceLocked ${JSON.stringify(
          await SharedWorkspaceLocking.IsWorkspaceLocked(`test-workspace-${uuidv4()}`, buildParameters),
        )}`,
      );
      CloudRunnerLogger.log(
        `GetFreeWorkspaces ${JSON.stringify(await SharedWorkspaceLocking.GetFreeWorkspaces(buildParameters))}`,
      );
      CloudRunnerLogger.log(
        `LockWorkspace ${JSON.stringify(
          await SharedWorkspaceLocking.LockWorkspace(`test-workspace-${uuidv4()}`, uuidv4(), buildParameters),
        )}`,
      );
      CloudRunnerLogger.log(
        `CreateLockableWorkspace ${JSON.stringify(
          await SharedWorkspaceLocking.CreateWorkspace(`test-workspace-${uuidv4()}`, buildParameters),
        )}`,
      );
      CloudRunnerLogger.log(
        `GetLockedWorkspace ${JSON.stringify(
          await SharedWorkspaceLocking.GetOrCreateLockedWorkspace(
            `test-workspace-${uuidv4()}`,
            uuidv4(),
            buildParameters,
          ),
        )}`,
      );
    }, 3000000);
  }
});
