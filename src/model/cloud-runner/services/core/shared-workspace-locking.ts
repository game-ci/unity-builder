import { CloudRunnerSystem } from './cloud-runner-system';
import fs from 'node:fs';
import CloudRunnerLogger from './cloud-runner-logger';
import BuildParameters from '../../../build-parameters';
import CloudRunner from '../../cloud-runner';
export class SharedWorkspaceLocking {
  public static get workspaceBucketRoot() {
    return `s3://${CloudRunner.buildParameters.awsStackName}/`;
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
      .filter((x) => x.endsWith(`_workspace`))
      .map((x) => x.split(`_`)[1]);
  }
  public static async DoesCacheKeyTopLevelExist(buildParametersContext: BuildParameters) {
    try {
      const rootLines = await SharedWorkspaceLocking.ReadLines(
        `aws s3 ls ${SharedWorkspaceLocking.workspaceBucketRoot}`,
      );
      const lockFolderExists = rootLines.map((x) => x.replace(`/`, ``)).includes(`locks`);

      if (lockFolderExists) {
        const lines = await SharedWorkspaceLocking.ReadLines(`aws s3 ls ${SharedWorkspaceLocking.workspaceRoot}`);

        return lines.map((x) => x.replace(`/`, ``)).includes(buildParametersContext.cacheKey);
      } else {
        return false;
      }
    } catch {
      return false;
    }
  }

  public static NewWorkspaceName() {
    return `${CloudRunner.retainedWorkspacePrefix}-${CloudRunner.buildParameters.buildGuid}`;
  }
  public static async GetAllLocksForWorkspace(
    workspace: string,
    buildParametersContext: BuildParameters,
  ): Promise<string[]> {
    if (!(await SharedWorkspaceLocking.DoesWorkspaceExist(workspace, buildParametersContext))) {
      return [];
    }

    return (
      await SharedWorkspaceLocking.ReadLines(
        `aws s3 ls ${SharedWorkspaceLocking.workspaceRoot}${buildParametersContext.cacheKey}/`,
      )
    )
      .map((x) => x.replace(`/`, ``))
      .filter((x) => x.includes(workspace) && x.endsWith(`_lock`));
  }
  public static async GetLockedWorkspace(workspace: string, runId: string, buildParametersContext: BuildParameters) {
    if (buildParametersContext.maxRetainedWorkspaces === 0) {
      return false;
    }

    if (await SharedWorkspaceLocking.DoesCacheKeyTopLevelExist(buildParametersContext)) {
      const workspaces = await SharedWorkspaceLocking.GetFreeWorkspaces(buildParametersContext);
      CloudRunnerLogger.log(`run agent ${runId} is trying to access a workspace, free: ${JSON.stringify(workspaces)}`);
      for (const element of workspaces) {
        const lockResult = await SharedWorkspaceLocking.LockWorkspace(element, runId, buildParametersContext);
        CloudRunnerLogger.log(
          `run agent: ${runId} try lock workspace: ${element} locking attempt result: ${lockResult}`,
        );

        if (lockResult) {
          return true;
        }
      }
    }

    if (await SharedWorkspaceLocking.DoesWorkspaceExist(workspace, buildParametersContext)) {
      workspace = SharedWorkspaceLocking.NewWorkspaceName();
      CloudRunner.lockedWorkspace = workspace;
    }

    const createResult = await SharedWorkspaceLocking.CreateWorkspace(workspace, buildParametersContext);
    const lockResult = await SharedWorkspaceLocking.LockWorkspace(workspace, runId, buildParametersContext);
    CloudRunnerLogger.log(
      `run agent ${runId} didn't find a free workspace so created: ${workspace} createWorkspaceSuccess: ${createResult} Lock:${lockResult}`,
    );

    return createResult && lockResult;
  }

  public static async DoesWorkspaceExist(workspace: string, buildParametersContext: BuildParameters) {
    return (
      (await SharedWorkspaceLocking.GetAllWorkspaces(buildParametersContext)).filter((x) => x.includes(workspace))
        .length > 0
    );
  }
  public static async HasWorkspaceLock(
    workspace: string,
    runId: string,
    buildParametersContext: BuildParameters,
  ): Promise<boolean> {
    const locks = (await SharedWorkspaceLocking.GetAllLocksForWorkspace(workspace, buildParametersContext))
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
      const isLocked = await SharedWorkspaceLocking.IsWorkspaceLocked(element, buildParametersContext);
      const isBelowMax = await SharedWorkspaceLocking.IsWorkspaceBelowMax(element, buildParametersContext);
      CloudRunnerLogger.log(`workspace ${element} locked:${isLocked} below max:${isBelowMax}`);
      if (!isLocked && isBelowMax) {
        result.push(element);
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
      .filter((x) => x.includes(workspace) && x.endsWith(`_workspace`))
      .map((x) => Number(x))[0];
  }

  public static async IsWorkspaceLocked(workspace: string, buildParametersContext: BuildParameters): Promise<boolean> {
    if (!(await SharedWorkspaceLocking.DoesWorkspaceExist(workspace, buildParametersContext))) {
      throw new Error(`workspace doesn't exist ${workspace}`);
    }
    const files = await SharedWorkspaceLocking.ReadLines(
      `aws s3 ls ${SharedWorkspaceLocking.workspaceRoot}${buildParametersContext.cacheKey}/`,
    );

    const lockFilesExist =
      files.filter((x) => {
        return x.includes(workspace) && x.endsWith(`_lock`);
      }).length > 0;

    return lockFilesExist;
  }

  public static async CreateWorkspace(workspace: string, buildParametersContext: BuildParameters): Promise<boolean> {
    if (await SharedWorkspaceLocking.DoesWorkspaceExist(workspace, buildParametersContext)) {
      throw new Error(`${workspace} already exists`);
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
      CloudRunnerLogger.log(`Workspace is above max ${workspaces} ${buildParametersContext.maxRetainedWorkspaces}`);
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
    } else {
      await CloudRunnerSystem.Run(
        `aws s3 rm ${SharedWorkspaceLocking.workspaceRoot}${buildParametersContext.cacheKey}/${file}`,
        false,
        true,
      );
    }

    return hasLock;
  }

  public static async ReleaseWorkspace(
    workspace: string,
    runId: string,
    buildParametersContext: BuildParameters,
  ): Promise<boolean> {
    const files = await SharedWorkspaceLocking.GetAllLocksForWorkspace(workspace, buildParametersContext);
    const file = files.find((x) => x.includes(workspace) && x.endsWith(`_lock`) && x.includes(runId));
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
