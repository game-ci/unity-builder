import SharedWorkspaceLocking from '../services/core/shared-workspace-locking';
import { Cli } from '../../cli/cli';
import setups from './cloud-runner-suite.test';
import CloudRunnerLogger from '../services/core/cloud-runner-logger';
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

describe('Cloud Runner Locking Core', () => {
  setups();
  it('Responds', () => {});
  if (CloudRunnerOptions.cloudRunnerDebug) {
    it(`Create Workspace`, async () => {
      const overrides: any = {
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.determineUnityVersion('test-project', UnityVersioning.read('test-project')),
        targetPlatform: 'StandaloneLinux64',
        cacheKey: `test-case-${uuidv4()}`,
        maxRetainedWorkspaces: 3,
      };
      const buildParameters = await CreateParameters(overrides);
      CloudRunner.buildParameters = buildParameters;
      const newWorkspaceName = `test-workspace-${uuidv4()}`;
      expect(await SharedWorkspaceLocking.CreateWorkspace(newWorkspaceName, buildParameters)).toBeTruthy();
    }, 150000);
    it(`Create Workspace And Lock Workspace`, async () => {
      const overrides: any = {
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.determineUnityVersion('test-project', UnityVersioning.read('test-project')),
        targetPlatform: 'StandaloneLinux64',
        cacheKey: `test-case-${uuidv4()}`,
        maxRetainedWorkspaces: 3,
      };
      const runId = uuidv4();
      const buildParameters = await CreateParameters(overrides);
      CloudRunner.buildParameters = buildParameters;
      const newWorkspaceName = `test-workspace-${uuidv4()}`;
      expect(await SharedWorkspaceLocking.CreateWorkspace(newWorkspaceName, buildParameters)).toBeTruthy();
      expect(await SharedWorkspaceLocking.LockWorkspace(newWorkspaceName, runId, buildParameters)).toBeTruthy();
    }, 150000);
    it(`0 free workspaces after locking`, async () => {
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
      expect(await SharedWorkspaceLocking.HasWorkspaceLock(newWorkspaceName, runId, buildParameters)).toBeTruthy();
      expect(await SharedWorkspaceLocking.DoesWorkspaceExist(newWorkspaceName, buildParameters)).toBeTruthy();
      expect(await SharedWorkspaceLocking.GetAllWorkspaces(buildParameters)).toHaveLength(1);
      expect(await SharedWorkspaceLocking.GetAllLocksForWorkspace(newWorkspaceName, buildParameters)).toHaveLength(1);
      expect(await SharedWorkspaceLocking.IsWorkspaceLocked(newWorkspaceName, buildParameters)).toBeTruthy();

      const files = await SharedWorkspaceLocking.ReadLines(
        `aws s3 ls ${SharedWorkspaceLocking.workspaceRoot}${buildParameters.cacheKey}/`,
      );

      const lockFilesExist =
        files.filter((x) => {
          return x.includes(newWorkspaceName) && x.endsWith(`_lock`);
        }).length > 0;

      expect(files).toHaveLength(2);
      expect(
        files.filter((x) => {
          return x.includes(newWorkspaceName) && x.endsWith(`_lock`);
        }),
      ).toHaveLength(1);
      expect(lockFilesExist).toBeTruthy();
      const result: string[] = [];
      const workspaces = await SharedWorkspaceLocking.GetAllWorkspaces(buildParameters);
      for (const element of workspaces) {
        expect((await SharedWorkspaceLocking.GetAllWorkspaces(buildParameters)).join()).toContain(element);
        expect(await SharedWorkspaceLocking.GetAllWorkspaces(buildParameters)).toHaveLength(1);
        expect(await SharedWorkspaceLocking.DoesWorkspaceExist(element, buildParameters)).toBeTruthy();
        await new Promise((promise) => setTimeout(promise, 1500));
        const isLocked = await SharedWorkspaceLocking.IsWorkspaceLocked(element, buildParameters);
        const isBelowMax = await SharedWorkspaceLocking.IsWorkspaceBelowMax(element, buildParameters);
        CloudRunnerLogger.log(`workspace ${element} locked:${isLocked} below max:${isBelowMax}`);
        const lock = files.find((x) => {
          return x.endsWith(`_lock`);
        });
        expect(lock).toContain(element);
        expect(isLocked).toBeTruthy();
        expect(isBelowMax).toBeTruthy();
        if (!isLocked && isBelowMax) {
          result.push(element);
        }
      }
      expect(result).toHaveLength(0);
      expect(await SharedWorkspaceLocking.GetFreeWorkspaces(buildParameters)).toHaveLength(0);
    }, 300000);
  }
});
