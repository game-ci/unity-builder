import { CloudRunnerSystem } from './cloud-runner-system';
import * as fs from 'fs';
import CloudRunnerLogger from './cloud-runner-logger';
import CloudRunnerOptions from '../cloud-runner-options';
import BuildParameters from '../../build-parameters';
import CloudRunner from '../cloud-runner';
export class SharedWorkspaceLocking {
  public static get workspaceBucketRoot() {
    return `s3://${CloudRunner.buildParameters.awsBaseStackName}/`;
  }
  public static get workspaceRoot() {
    return `${SharedWorkspaceLocking.workspaceBucketRoot}locks/`;
  }
  public static async GetAllWorkspaces(buildParametersContext: BuildParameters): Promise<string[]> {
    if (!(await SharedWorkspaceLocking.DoesCacheKeyTopLevelExist(buildParametersContext))) {
      return [];
    }

    return (
      await SharedWorkspaceLocking.ReadLines(
        `aws s3 ls ${SharedWorkspaceLocking.workspaceRoot}${buildParametersContext.cacheKey}/`,
      )
    )
      .map((x) => x.replace(`/`, ``))
      .filter((x) => x.endsWith(`_workspace`));
  }
  public static async DoesCacheKeyTopLevelExist(buildParametersContext: BuildParameters) {
    const lines = await SharedWorkspaceLocking.ReadLines(`aws s3 ls ${SharedWorkspaceLocking.workspaceRoot}`);

    return lines.map((x) => x.replace(`/`, ``)).includes(buildParametersContext.cacheKey);
  }
  public static async GetAllLocks(workspace: string, buildParametersContext: BuildParameters): Promise<string[]> {
    if (!(await SharedWorkspaceLocking.DoesWorkspaceExist(workspace, buildParametersContext))) {
      return [];
    }

    return (
      await SharedWorkspaceLocking.ReadLines(
        `aws s3 ls ${SharedWorkspaceLocking.workspaceRoot}${buildParametersContext.cacheKey}/`,
      )
    )
      .map((x) => x.replace(`/`, ``))
      .filter((x) => x.endsWith(`${workspace}_workspace_lock`));
  }
  public static async GetOrCreateLockedWorkspace(
    workspace: string,
    runId: string,
    buildParametersContext: BuildParameters,
  ) {
    if (!CloudRunnerOptions.retainWorkspaces) {
      return false;
    }

    try {
      if (await SharedWorkspaceLocking.DoesCacheKeyTopLevelExist(buildParametersContext)) {
        const workspaces = await SharedWorkspaceLocking.GetFreeWorkspaces(buildParametersContext);
        CloudRunnerLogger.log(
          `run agent ${runId} is trying to access a workspace, free: ${JSON.stringify(workspaces)}`,
        );
        for (const element of workspaces) {
          await new Promise((promise) => setTimeout(promise, 1000));
          const lockResult = await SharedWorkspaceLocking.LockWorkspace(element, runId, buildParametersContext);
          CloudRunnerLogger.log(`run agent: ${runId} try lock workspace: ${element} result: ${lockResult}`);

          if (lockResult) {
            return true;
          }
        }
      }
    } catch (error) {
      CloudRunnerLogger.log(JSON.stringify(error, undefined, 4));

      return false;
    }

    const createResult = await SharedWorkspaceLocking.CreateWorkspace(workspace, buildParametersContext, runId);
    const lockResult = await SharedWorkspaceLocking.LockWorkspace(workspace, runId, buildParametersContext);
    CloudRunnerLogger.log(
      `run agent ${runId} didn't find a free workspace so created: ${workspace} createWorkspaceSuccess: ${
        createResult && lockResult
      }`,
    );

    return createResult && lockResult;
  }

  public static async DoesWorkspaceExist(workspace: string, buildParametersContext: BuildParameters) {
    return (
      (await SharedWorkspaceLocking.GetAllWorkspaces(buildParametersContext)).filter((x) =>
        x.endsWith(`${workspace}_workspace`),
      ).length > 0
    );
  }
  public static async HasWorkspaceLock(
    workspace: string,
    runId: string,
    buildParametersContext: BuildParameters,
  ): Promise<boolean> {
    const locks = (await SharedWorkspaceLocking.GetAllLocks(workspace, buildParametersContext))
      .map((x) => {
        return {
          name: x,
          timestamp: Number(x.split(`_`)[0]),
        };
      })
      .sort((x) => x.timestamp);
    const lockMatches = locks.filter((x) => x.name.includes(runId));
    const includesRunLock = lockMatches.length > 0 && locks.indexOf(lockMatches[0]) === 0;
    CloudRunnerLogger.log(
      `Checking has workspace lock, runId: ${runId}, workspace: ${workspace}, success: ${includesRunLock} \n- Num of locks created by Run Agent: ${
        lockMatches.length
      } Num of Locks: ${locks.length}, Time ordered index for Run Agent: ${locks.indexOf(lockMatches[0])} \n \n`,
    );

    return includesRunLock;
  }

  public static async GetFreeWorkspaces(buildParametersContext: BuildParameters): Promise<string[]> {
    const result: string[] = [];
    const workspaces = await SharedWorkspaceLocking.GetAllWorkspaces(buildParametersContext);
    for (const element of workspaces) {
      await new Promise((promise) => setTimeout(promise, 1500));
      const isLocked = await SharedWorkspaceLocking.IsWorkspaceLocked(element, buildParametersContext);
      const isBelowMax = await SharedWorkspaceLocking.IsWorkspaceBelowMax(element, buildParametersContext);
      if (!isLocked && isBelowMax) {
        result.push(element);
        CloudRunnerLogger.log(`workspace ${element} is free`);
      } else {
        CloudRunnerLogger.log(`workspace ${element} is NOT free ${!isLocked} ${isBelowMax}`);
      }
    }

    return result;
  }

  public static async IsWorkspaceBelowMax(
    workspace: string,
    buildParametersContext: BuildParameters,
  ): Promise<boolean> {
    const workspaces = await SharedWorkspaceLocking.GetAllWorkspaces(buildParametersContext);
    if (workspace === ``) {
      return (
        workspaces.length < buildParametersContext.maxRetainedWorkspaces ||
        buildParametersContext.maxRetainedWorkspaces === 0
      );
    }
    const ordered: any[] = [];
    for (const ws of workspaces) {
      ordered.push({
        name: ws,
        timestamp: await SharedWorkspaceLocking.GetWorkspaceTimestamp(ws, buildParametersContext),
      });
    }
    ordered.sort((x) => x.timestamp);
    const matches = ordered.filter((x) => x.name.includes(workspace));
    const isWorkspaceBelowMax =
      matches.length > 0 &&
      (ordered.indexOf(matches[0]) < buildParametersContext.maxRetainedWorkspaces ||
        buildParametersContext.maxRetainedWorkspaces === 0);

    return isWorkspaceBelowMax;
  }

  public static async GetWorkspaceTimestamp(
    workspace: string,
    buildParametersContext: BuildParameters,
  ): Promise<Number> {
    if (workspace.split(`_`).length > 0) {
      return Number(workspace.split(`_`)[1]);
    }

    if (!(await SharedWorkspaceLocking.DoesWorkspaceExist(workspace, buildParametersContext))) {
      throw new Error("Workspace doesn't exist, can't call get all locks");
    }

    return (
      await SharedWorkspaceLocking.ReadLines(
        `aws s3 ls ${SharedWorkspaceLocking.workspaceRoot}${buildParametersContext.cacheKey}/`,
      )
    )
      .map((x) => x.replace(`/`, ``))
      .filter((x) => x.endsWith(`_${workspace}_workspace`))
      .map((x) => Number(x))[0];
  }

  public static async IsWorkspaceLocked(workspace: string, buildParametersContext: BuildParameters): Promise<boolean> {
    if (!(await SharedWorkspaceLocking.DoesWorkspaceExist(workspace, buildParametersContext))) {
      return false;
    }
    const files = await SharedWorkspaceLocking.ReadLines(
      `aws s3 ls ${SharedWorkspaceLocking.workspaceRoot}${buildParametersContext.cacheKey}/`,
    );

    const workspaceFileDoesNotExists =
      files.filter((x) => {
        return x.endsWith(`${workspace}_workspace`);
      }).length === 0;

    if (workspaceFileDoesNotExists) {
      throw new Error(`Workspace file doesn't exist`);
    }

    const lockFilesExist =
      files.filter((x) => {
        return x.endsWith(`${workspace}_workspace_lock`);
      }).length > 0;

    return lockFilesExist;
  }

  public static async CreateWorkspace(
    workspace: string,
    buildParametersContext: BuildParameters,
    lockId: string = ``,
  ): Promise<boolean> {
    if (lockId !== ``) {
      await SharedWorkspaceLocking.LockWorkspace(workspace, lockId, buildParametersContext);
    }
    const timestamp = Date.now();
    const file = `${timestamp}_${workspace}_workspace`;
    fs.writeFileSync(file, '');
    await CloudRunnerSystem.Run(
      `aws s3 cp ./${file} ${SharedWorkspaceLocking.workspaceRoot}${buildParametersContext.cacheKey}/${file}`,
      false,
      true,
    );
    fs.rmSync(file);

    const workspaces = await SharedWorkspaceLocking.GetAllWorkspaces(buildParametersContext);

    CloudRunnerLogger.log(`All workspaces ${workspaces}`);
    if (!(await SharedWorkspaceLocking.IsWorkspaceBelowMax(workspace, buildParametersContext))) {
      CloudRunnerLogger.log(`Workspace is below max ${workspaces} ${buildParametersContext.maxRetainedWorkspaces}`);
      await SharedWorkspaceLocking.CleanupWorkspace(workspace, buildParametersContext);

      return false;
    }

    return true;
  }

  public static async LockWorkspace(
    workspace: string,
    runId: string,
    buildParametersContext: BuildParameters,
  ): Promise<boolean> {
    const existingWorkspace = workspace.endsWith(`_workspace`);
    const ending = existingWorkspace ? workspace : `${workspace}_workspace`;
    const file = `${Date.now()}_${runId}_${ending}_lock`;
    fs.writeFileSync(file, '');
    await CloudRunnerSystem.Run(
      `aws s3 cp ./${file} ${SharedWorkspaceLocking.workspaceRoot}${buildParametersContext.cacheKey}/${file}`,
      false,
      true,
    );
    fs.rmSync(file);

    const hasLock = await SharedWorkspaceLocking.HasWorkspaceLock(workspace, runId, buildParametersContext);

    if (hasLock) {
      CloudRunner.lockedWorkspace = workspace;
    }

    return hasLock;
  }

  public static async ReleaseWorkspace(
    workspace: string,
    runId: string,
    buildParametersContext: BuildParameters,
  ): Promise<boolean> {
    const files = await SharedWorkspaceLocking.GetAllLocks(workspace, buildParametersContext);
    const file = files.find((x) => x.endsWith(`${workspace}_workspace_lock`) && x.includes(runId));
    CloudRunnerLogger.log(`All Locks ${files} ${workspace} ${runId}`);
    CloudRunnerLogger.log(`Deleting lock ${workspace}/${file}`);
    CloudRunnerLogger.log(`rm ${SharedWorkspaceLocking.workspaceRoot}${buildParametersContext.cacheKey}/${file}`);
    await CloudRunnerSystem.Run(
      `aws s3 rm ${SharedWorkspaceLocking.workspaceRoot}${buildParametersContext.cacheKey}/${file}`,
      false,
      true,
    );

    return !(await SharedWorkspaceLocking.HasWorkspaceLock(workspace, runId, buildParametersContext));
  }

  public static async CleanupWorkspace(workspace: string, buildParametersContext: BuildParameters) {
    await CloudRunnerSystem.Run(
      `aws s3 rm ${SharedWorkspaceLocking.workspaceRoot}${buildParametersContext.cacheKey} --exclude "*" --include "*_${workspace}_*"`,
      false,
      true,
    );
  }

  public static async ReadLines(command: string): Promise<string[]> {
    return CloudRunnerSystem.RunAndReadLines(command);
  }
}

export default SharedWorkspaceLocking;
