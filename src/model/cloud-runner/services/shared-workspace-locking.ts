import { CloudRunnerSystem } from './cloud-runner-system';
import * as fs from 'fs';
import CloudRunnerLogger from './cloud-runner-logger';
import CloudRunnerOptions from '../cloud-runner-options';
import BuildParameters from '../../build-parameters';
export class SharedWorkspaceLocking {
  private static readonly workspaceRoot = `s3://game-ci-test-storage/locks/`;
  public static async GetAllWorkspaces(buildParametersContext: BuildParameters): Promise<string[]> {
    return (
      await SharedWorkspaceLocking.ReadLines(
        `aws s3 ls ${SharedWorkspaceLocking.workspaceRoot}${buildParametersContext.cacheKey}/`,
      )
    ).map((x) => x.replace(`/`, ``));
  }
  public static async DoesWorkspaceTopLevelExist(buildParametersContext: BuildParameters) {
    const results = (await SharedWorkspaceLocking.ReadLines(`aws s3 ls ${SharedWorkspaceLocking.workspaceRoot}`)).map(
      (x) => x.replace(`/`, ``),
    );

    return results.includes(buildParametersContext.cacheKey);
  }
  public static async GetAllLocks(workspace: string, buildParametersContext: BuildParameters): Promise<string[]> {
    if (!(await SharedWorkspaceLocking.DoesWorkspaceExist(workspace, buildParametersContext))) {
      throw new Error("Workspace doesn't exist, can't call get all locks");
    }

    return (
      await SharedWorkspaceLocking.ReadLines(
        `aws s3 ls ${SharedWorkspaceLocking.workspaceRoot}${buildParametersContext.cacheKey}/${workspace}/`,
      )
    ).map((x) => x.replace(`/`, ``));
  }
  public static async GetOrCreateLockedWorkspace(
    workspaceIfCreated: string,
    runId: string,
    buildParametersContext: BuildParameters,
  ) {
    if (!CloudRunnerOptions.retainWorkspaces) {
      return;
    }

    CloudRunnerLogger.log(`run agent ${runId} is trying to access a workspace`);

    if (await SharedWorkspaceLocking.DoesWorkspaceTopLevelExist(buildParametersContext)) {
      const workspaces = await SharedWorkspaceLocking.GetFreeWorkspaces(buildParametersContext);
      for (const element of workspaces) {
        if (await SharedWorkspaceLocking.LockWorkspace(element, runId, buildParametersContext)) {
          CloudRunnerLogger.log(`run agent ${runId} locked workspace: ${element}`);

          return element;
        }
      }
    }

    const workspace = await SharedWorkspaceLocking.CreateWorkspace(workspaceIfCreated, buildParametersContext, runId);
    CloudRunnerLogger.log(`run agent ${runId} didn't find a free workspace so created: ${workspace}`);

    return workspace;
  }

  public static async DoesWorkspaceExist(workspace: string, buildParametersContext: BuildParameters) {
    return (await SharedWorkspaceLocking.GetAllWorkspaces(buildParametersContext)).includes(workspace);
  }
  public static async HasWorkspaceLock(
    workspace: string,
    runId: string,
    buildParametersContext: BuildParameters,
  ): Promise<boolean> {
    if (!(await SharedWorkspaceLocking.DoesWorkspaceExist(workspace, buildParametersContext))) {
      return false;
    }
    CloudRunnerLogger.log(`Checking has workspace ${workspace} was locked`);
    const locks = await SharedWorkspaceLocking.GetAllLocks(workspace, buildParametersContext);
    const includesRunLock = locks.filter((x) => x.includes(runId)).length > 0;
    CloudRunnerLogger.log(`Locks ${locks}, includes ${includesRunLock}`);

    return includesRunLock;
  }

  public static async GetFreeWorkspaces(buildParametersContext: BuildParameters): Promise<string[]> {
    const result: string[] = [];
    const workspaces = await SharedWorkspaceLocking.GetAllWorkspaces(buildParametersContext);
    for (const element of workspaces) {
      if (!(await SharedWorkspaceLocking.IsWorkspaceLocked(element, buildParametersContext))) {
        result.push(element);
      }
    }

    return result;
  }

  public static async IsWorkspaceLocked(workspace: string, buildParametersContext: BuildParameters): Promise<boolean> {
    if (!(await SharedWorkspaceLocking.DoesWorkspaceExist(workspace, buildParametersContext))) {
      return false;
    }
    const files = await SharedWorkspaceLocking.ReadLines(
      `aws s3 ls ${SharedWorkspaceLocking.workspaceRoot}${buildParametersContext.cacheKey}/${workspace}/`,
    );

    const workspaceFileDoesNotExists =
      files.filter((x) => {
        return x.includes(`_workspace`);
      }).length === 0;

    const lockFilesExist =
      files.filter((x) => {
        return x.includes(`_lock`);
      }).length > 0;

    return workspaceFileDoesNotExists || lockFilesExist;
  }

  public static async CreateWorkspace(workspace: string, buildParametersContext: BuildParameters, lockId: string = ``) {
    if (lockId !== ``) {
      await SharedWorkspaceLocking.LockWorkspace(workspace, lockId, buildParametersContext);
    }

    const file = `${Date.now()}_workspace`;
    fs.writeFileSync(file, '');
    await CloudRunnerSystem.Run(
      `aws s3 cp ./${file} ${SharedWorkspaceLocking.workspaceRoot}${buildParametersContext.cacheKey}/${workspace}/${file}`,
      false,
      true,
    );
    fs.rmSync(file);

    const workspaces = await SharedWorkspaceLocking.ReadLines(
      `aws s3 ls ${SharedWorkspaceLocking.workspaceRoot}${buildParametersContext.cacheKey}/`,
    );

    CloudRunnerLogger.log(`All workspaces ${workspaces}`);

    return workspace;
  }

  public static async LockWorkspace(
    workspace: string,
    runId: string,
    buildParametersContext: BuildParameters,
  ): Promise<boolean> {
    const file = `${Date.now()}_${runId}_lock`;
    fs.writeFileSync(file, '');
    await CloudRunnerSystem.Run(
      `aws s3 cp ./${file} ${SharedWorkspaceLocking.workspaceRoot}${buildParametersContext.cacheKey}/${workspace}/${file}`,
      false,
      true,
    );
    fs.rmSync(file);

    return SharedWorkspaceLocking.HasWorkspaceLock(workspace, runId, buildParametersContext);
  }

  public static async ReleaseWorkspace(
    workspace: string,
    runId: string,
    buildParametersContext: BuildParameters,
  ): Promise<boolean> {
    if (!(await SharedWorkspaceLocking.DoesWorkspaceExist(workspace, buildParametersContext))) {
      return true;
    }
    const file = (await SharedWorkspaceLocking.GetAllLocks(workspace, buildParametersContext)).filter((x) =>
      x.includes(`_${runId}_lock`),
    );
    CloudRunnerLogger.log(
      `${JSON.stringify(await SharedWorkspaceLocking.GetAllLocks(workspace, buildParametersContext))}`,
    );
    CloudRunnerLogger.log(`Deleting file ${file}`);
    CloudRunnerLogger.log(
      `aws s3 rm ${SharedWorkspaceLocking.workspaceRoot}${buildParametersContext.cacheKey}/${workspace}/${file}`,
    );
    await CloudRunnerSystem.Run(
      `aws s3 rm ${SharedWorkspaceLocking.workspaceRoot}${buildParametersContext.cacheKey}/${workspace}/${file}`,
      false,
      true,
    );

    return !SharedWorkspaceLocking.HasWorkspaceLock(workspace, runId, buildParametersContext);
  }

  public static async CleanupWorkspace(workspace: string, buildParametersContext: BuildParameters) {
    await CloudRunnerSystem.Run(
      `aws s3 rm ${SharedWorkspaceLocking.workspaceRoot}${buildParametersContext.cacheKey}/${workspace} --recursive`,
      false,
      true,
    );
  }

  private static async ReadLines(command: string): Promise<string[]> {
    return CloudRunnerSystem.RunAndReadLines(command);
  }
}

export default SharedWorkspaceLocking;
