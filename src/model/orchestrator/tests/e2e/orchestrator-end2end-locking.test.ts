import Orchestrator from '../../orchestrator';
import { BuildParameters } from '../../..';
import UnityVersioning from '../../../unity-versioning';
import { Cli } from '../../../cli/cli';
import OrchestratorLogger from '../../services/core/orchestrator-logger';
import { v4 as uuidv4 } from 'uuid';
import OrchestratorOptions from '../../options/orchestrator-options';
import setups from '../orchestrator-suite.test';
import SharedWorkspaceLocking from '../../services/core/shared-workspace-locking';

async function CreateParameters(overrides: any) {
  if (overrides) {
    Cli.options = overrides;
  }

  return await BuildParameters.create();
}

describe('Orchestrator Locking', () => {
  setups();
  it('Responds', () => {});
  if (OrchestratorOptions.orchestratorDebug) {
    it(`Simple Locking End2End Flow`, async () => {
      const overrides: any = {
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.determineUnityVersion('test-project', UnityVersioning.read('test-project')),
        targetPlatform: 'StandaloneLinux64',
        cacheKey: `test-case-${uuidv4()}`,
        maxRetainedWorkspaces: 3,
      };
      const buildParameters = await CreateParameters(overrides);

      const newWorkspaceName = `test-workspace-${uuidv4()}`;
      const runId = uuidv4();
      Orchestrator.buildParameters = buildParameters;
      await SharedWorkspaceLocking.CreateWorkspace(newWorkspaceName, buildParameters);
      expect(await SharedWorkspaceLocking.DoesCacheKeyTopLevelExist(buildParameters)).toBeTruthy();
      expect(await SharedWorkspaceLocking.DoesWorkspaceExist(newWorkspaceName, buildParameters)).toBeTruthy();
      const isExpectedUnlockedBeforeLocking =
        (await SharedWorkspaceLocking.IsWorkspaceLocked(newWorkspaceName, buildParameters)) === false;
      expect(isExpectedUnlockedBeforeLocking).toBeTruthy();
      const result = await SharedWorkspaceLocking.LockWorkspace(newWorkspaceName, runId, buildParameters);
      expect(result).toBeTruthy();
      const lines = await SharedWorkspaceLocking.ReadLines(`aws s3 ls ${SharedWorkspaceLocking.workspaceRoot}`);
      expect(lines.map((x) => x.replace(`/`, ``)).includes(buildParameters.cacheKey));
      expect(await SharedWorkspaceLocking.DoesCacheKeyTopLevelExist(buildParameters)).toBeTruthy();
      expect(await SharedWorkspaceLocking.DoesWorkspaceExist(newWorkspaceName, buildParameters)).toBeTruthy();
      const allLocks = await SharedWorkspaceLocking.GetAllLocksForWorkspace(newWorkspaceName, buildParameters);
      expect(
        (
          await SharedWorkspaceLocking.ReadLines(
            `aws s3 ls ${SharedWorkspaceLocking.workspaceRoot}${buildParameters.cacheKey}/`,
          )
        ).filter((x) => x.endsWith(`${newWorkspaceName}_workspace_lock`)),
      ).toHaveLength(1);
      expect(
        (
          await SharedWorkspaceLocking.ReadLines(
            `aws s3 ls ${SharedWorkspaceLocking.workspaceRoot}${buildParameters.cacheKey}/`,
          )
        ).filter((x) => x.endsWith(`${newWorkspaceName}_workspace`)),
      ).toHaveLength(1);
      expect(allLocks.filter((x) => x.endsWith(`${newWorkspaceName}_workspace_lock`)).length).toBeGreaterThan(0);
      const isExpectedLockedAfterLocking =
        (await SharedWorkspaceLocking.IsWorkspaceLocked(newWorkspaceName, buildParameters)) === true;
      expect(isExpectedLockedAfterLocking).toBeTruthy();
      const locksBeforeRelease = await SharedWorkspaceLocking.GetAllLocksForWorkspace(
        newWorkspaceName,
        buildParameters,
      );
      OrchestratorLogger.log(JSON.stringify(locksBeforeRelease, undefined, 4));
      expect(locksBeforeRelease.length).toBe(1);
      await SharedWorkspaceLocking.ReleaseWorkspace(newWorkspaceName, runId, buildParameters);
      const locks = await SharedWorkspaceLocking.GetAllLocksForWorkspace(newWorkspaceName, buildParameters);
      expect(locks.length).toBe(0);
      const isExpectedNotLockedAfterReleasing =
        (await SharedWorkspaceLocking.IsWorkspaceLocked(newWorkspaceName, buildParameters)) === false;
      expect(isExpectedNotLockedAfterReleasing).toBeTruthy();
      const lockingResult2 = await SharedWorkspaceLocking.LockWorkspace(newWorkspaceName, runId, buildParameters);
      expect(lockingResult2).toBeTruthy();
      expect((await SharedWorkspaceLocking.IsWorkspaceLocked(newWorkspaceName, buildParameters)) === true).toBeTruthy();
      await SharedWorkspaceLocking.ReleaseWorkspace(newWorkspaceName, runId, buildParameters);
      expect(
        (await SharedWorkspaceLocking.IsWorkspaceLocked(newWorkspaceName, buildParameters)) === false,
      ).toBeTruthy();
      await SharedWorkspaceLocking.CleanupWorkspace(newWorkspaceName, buildParameters);
      OrchestratorLogger.log(`Starting get or create`);
      expect(await SharedWorkspaceLocking.GetLockedWorkspace(newWorkspaceName, runId, buildParameters)).toBeTruthy();
    }, 350000);
  }
});
