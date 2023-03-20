import SharedWorkspaceLocking from '../services/shared-workspace-locking';
import { Cli } from '../../cli/cli';
import setups from './cloud-runner-suite.test';
import { v4 as uuidv4 } from 'uuid';
import CloudRunnerOptions from '../cloud-runner-options';
import UnityVersioning from '../../unity-versioning';
import BuildParameters from '../../build-parameters';
import CloudRunner from '../cloud-runner';

async function CreateParameters(overrides: any) {
  if (overrides) {
    Cli.options = overrides;
  }

  return await BuildParameters.create();
}

describe('Cloud Runner Locking Upsert', () => {
  setups();
  it('Responds', () => {});
  if (CloudRunnerOptions.cloudRunnerDebug) {
    it(`Get Or Create From No Workspace`, async () => {
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
      CloudRunner.buildParameters = buildParameters;
      expect(
        await SharedWorkspaceLocking.GetOrCreateLockedWorkspace(newWorkspaceName, runId, buildParameters),
      ).toBeTruthy();
    }, 150000);
    it(`Get Or Create From Unlocked`, async () => {
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
      CloudRunner.buildParameters = buildParameters;
      expect(await SharedWorkspaceLocking.CreateWorkspace(newWorkspaceName, buildParameters)).toBeTruthy();
      expect(
        await SharedWorkspaceLocking.GetOrCreateLockedWorkspace(newWorkspaceName, runId, buildParameters),
      ).toBeTruthy();
      expect(CloudRunner.lockedWorkspace).toMatch(newWorkspaceName);
    }, 300000);
    it(`Get Or Create From Locked`, async () => {
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
      const runId2 = uuidv4();
      CloudRunner.buildParameters = buildParameters;
      expect(await SharedWorkspaceLocking.CreateWorkspace(newWorkspaceName, buildParameters)).toBeTruthy();
      expect(await SharedWorkspaceLocking.LockWorkspace(newWorkspaceName, runId, buildParameters)).toBeTruthy();
      expect(await SharedWorkspaceLocking.HasWorkspaceLock(newWorkspaceName, runId, buildParameters)).toBeTruthy();
      expect(await SharedWorkspaceLocking.IsWorkspaceLocked(newWorkspaceName, buildParameters)).toBeTruthy();
      expect(await SharedWorkspaceLocking.IsWorkspaceBelowMax(newWorkspaceName, buildParameters)).toBeTruthy();
      expect(await SharedWorkspaceLocking.DoesWorkspaceExist(newWorkspaceName, buildParameters)).toBeTruthy();
      expect(
        await SharedWorkspaceLocking.GetOrCreateLockedWorkspace(newWorkspaceName, runId2, buildParameters),
      ).toBeTruthy();
      expect(CloudRunner.lockedWorkspace).not.toMatch(newWorkspaceName);
    }, 300000);
    it(`Get Or Create After Double Lock And One Unlock`, async () => {
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
      const runId2 = uuidv4();
      CloudRunner.buildParameters = buildParameters;
      expect(await SharedWorkspaceLocking.CreateWorkspace(newWorkspaceName, buildParameters)).toBeTruthy();
      expect(await SharedWorkspaceLocking.LockWorkspace(newWorkspaceName, runId, buildParameters)).toBeTruthy();
      expect(await SharedWorkspaceLocking.IsWorkspaceLocked(newWorkspaceName, buildParameters)).toBeTruthy();
      expect(await SharedWorkspaceLocking.ReleaseWorkspace(newWorkspaceName, runId, buildParameters)).toBeTruthy();
      expect(await SharedWorkspaceLocking.IsWorkspaceLocked(newWorkspaceName, buildParameters)).toBeFalsy();
      expect(await SharedWorkspaceLocking.LockWorkspace(newWorkspaceName, runId, buildParameters)).toBeTruthy();
      expect(await SharedWorkspaceLocking.HasWorkspaceLock(newWorkspaceName, runId, buildParameters)).toBeTruthy();
      expect(await SharedWorkspaceLocking.IsWorkspaceLocked(newWorkspaceName, buildParameters)).toBeTruthy();
      expect(await SharedWorkspaceLocking.DoesWorkspaceExist(newWorkspaceName, buildParameters)).toBeTruthy();
      expect(
        await SharedWorkspaceLocking.GetOrCreateLockedWorkspace(newWorkspaceName, runId2, buildParameters),
      ).toBeTruthy();
      expect(CloudRunner.lockedWorkspace).not.toContain(newWorkspaceName);
    }, 300000);
    it(`Get Or Create After Double Lock And Unlock`, async () => {
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
      const runId2 = uuidv4();
      CloudRunner.buildParameters = buildParameters;
      expect(await SharedWorkspaceLocking.CreateWorkspace(newWorkspaceName, buildParameters)).toBeTruthy();
      expect(await SharedWorkspaceLocking.LockWorkspace(newWorkspaceName, runId, buildParameters)).toBeTruthy();
      expect(await SharedWorkspaceLocking.IsWorkspaceLocked(newWorkspaceName, buildParameters)).toBeTruthy();
      expect(await SharedWorkspaceLocking.ReleaseWorkspace(newWorkspaceName, runId, buildParameters)).toBeTruthy();
      expect(await SharedWorkspaceLocking.IsWorkspaceLocked(newWorkspaceName, buildParameters)).toBeFalsy();
      expect(await SharedWorkspaceLocking.LockWorkspace(newWorkspaceName, runId, buildParameters)).toBeTruthy();
      expect(await SharedWorkspaceLocking.HasWorkspaceLock(newWorkspaceName, runId, buildParameters)).toBeTruthy();
      expect(await SharedWorkspaceLocking.ReleaseWorkspace(newWorkspaceName, runId, buildParameters)).toBeTruthy();
      expect(await SharedWorkspaceLocking.IsWorkspaceLocked(newWorkspaceName, buildParameters)).toBeFalsy();
      expect(await SharedWorkspaceLocking.DoesWorkspaceExist(newWorkspaceName, buildParameters)).toBeTruthy();
      expect(
        await SharedWorkspaceLocking.GetOrCreateLockedWorkspace(newWorkspaceName, runId2, buildParameters),
      ).toBeTruthy();
      expect(CloudRunner.lockedWorkspace).toContain(newWorkspaceName);
    }, 300000);
    it(`Get Or Create From Unlocked Was Locked`, async () => {
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
      CloudRunner.buildParameters = buildParameters;
      expect(await SharedWorkspaceLocking.CreateWorkspace(newWorkspaceName, buildParameters)).toBeTruthy();
      expect(await SharedWorkspaceLocking.LockWorkspace(newWorkspaceName, runId, buildParameters)).toBeTruthy();
      expect(await SharedWorkspaceLocking.ReleaseWorkspace(newWorkspaceName, runId, buildParameters)).toBeTruthy();
      expect(
        await SharedWorkspaceLocking.GetOrCreateLockedWorkspace(newWorkspaceName, runId, buildParameters),
      ).toBeTruthy();
      expect(CloudRunner.lockedWorkspace).toMatch(newWorkspaceName);
    }, 300000);
  }
});
