import SharedWorkspaceLocking from '../services/core/shared-workspace-locking';
import { Cli } from '../../cli/cli';
import setups from './cloud-runner-suite.test';
import { v4 as uuidv4 } from 'uuid';
import CloudRunnerOptions from '../options/cloud-runner-options';
import UnityVersioning from '../../unity-versioning';
import BuildParameters from '../../build-parameters';
import CloudRunner from '../cloud-runner';

async function CreateParameters(overrides: any) {
  if (overrides) {
    Cli.options = overrides;
  }

  return await BuildParameters.create();
}

describe('Cloud Runner Locking Get Locked Workspace', () => {
  setups();
  it('Responds', () => {});
  if (CloudRunnerOptions.cloudRunnerDebug) {
    it(`Get locked workspace From No Workspace`, async () => {
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
      expect(await SharedWorkspaceLocking.GetLockedWorkspace(newWorkspaceName, runId, buildParameters)).toBeTruthy();
    }, 150000);
    it(`Get locked workspace from unlocked`, async () => {
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
      expect(await SharedWorkspaceLocking.GetLockedWorkspace(newWorkspaceName, runId, buildParameters)).toBeTruthy();
      expect(CloudRunner.lockedWorkspace).toMatch(newWorkspaceName);
    }, 300000);
    it(`Get locked workspace from locked`, async () => {
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
      expect(await SharedWorkspaceLocking.GetLockedWorkspace(newWorkspaceName, runId2, buildParameters)).toBeTruthy();
      expect(CloudRunner.lockedWorkspace).not.toMatch(newWorkspaceName);
    }, 300000);
    it(`Get locked workspace after double lock and one unlock`, async () => {
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
      expect(await SharedWorkspaceLocking.GetLockedWorkspace(newWorkspaceName, runId2, buildParameters)).toBeTruthy();
      expect(CloudRunner.lockedWorkspace).not.toContain(newWorkspaceName);
    }, 300000);
    it(`Get locked workspace after double lock and unlock`, async () => {
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
      expect(await SharedWorkspaceLocking.GetLockedWorkspace(newWorkspaceName, runId2, buildParameters)).toBeTruthy();
      expect(CloudRunner.lockedWorkspace).toContain(newWorkspaceName);
    }, 300000);
    it(`Get locked workspace from unlocked was locked`, async () => {
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
      expect(await SharedWorkspaceLocking.GetLockedWorkspace(newWorkspaceName, runId, buildParameters)).toBeTruthy();
      expect(CloudRunner.lockedWorkspace).toMatch(newWorkspaceName);
    }, 300000);
  }
});
