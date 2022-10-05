import { CloudRunnerSystem } from '../cloud-runner/services/cloud-runner-system';
import * as fs from 'fs';
import CloudRunnerLogger from '../cloud-runner/services/cloud-runner-logger';
import CloudRunnerOptions from '../cloud-runner/cloud-runner-options';
export class SharedWorkspaceLocking {
  private static readonly workspaceRoot = `s3://game-ci-test-storage/locks/`;
  public static async GetAllWorkspaces(): Promise<string[]> {
    return (await SharedWorkspaceLocking.ReadLines(`aws s3 ls ${SharedWorkspaceLocking.workspaceRoot}`)).map((x) =>
      x.replace(`/`, ``),
    );
  }
  public static async GetAllLocks(workspace: string): Promise<string[]> {
    if (!(await SharedWorkspaceLocking.DoesWorkspaceExist(workspace))) {
      throw new Error("Workspace doesn't exist, can't call get all locks");
    }

    return (
      await SharedWorkspaceLocking.ReadLines(`aws s3 ls ${SharedWorkspaceLocking.workspaceRoot}${workspace}/`)
    ).map((x) => x.replace(`/`, ``));
  }
  public static async GetOrCreateLockedWorkspace(workspaceIfCreated: string, runId: string) {
    if (!CloudRunnerOptions.retainWorkspaces) {
      return;
    }

    CloudRunnerLogger.log(`run agent ${runId} is trying to access a workspace`);

    const workspaces = await SharedWorkspaceLocking.GetFreeWorkspaces();
    for (const element of workspaces) {
      if (await SharedWorkspaceLocking.LockWorkspace(element, runId)) {
        CloudRunnerLogger.log(`run agent ${runId} locked workspace: ${element}`);

        return element;
      }
    }

    const workspace = await SharedWorkspaceLocking.CreateWorkspace(workspaceIfCreated, runId);
    CloudRunnerLogger.log(`run agent ${runId} didn't find a free workspace so created: ${workspace}`);

    return workspace;
  }

  public static async DoesWorkspaceExist(workspace: string) {
    return (await SharedWorkspaceLocking.GetAllWorkspaces()).includes(workspace);
  }
  public static async HasWorkspaceLock(workspace: string, runId: string): Promise<boolean> {
    if (!(await SharedWorkspaceLocking.DoesWorkspaceExist(workspace))) {
      return false;
    }

    return (await SharedWorkspaceLocking.GetAllLocks(workspace)).filter((x) => x.includes(runId)).length > 0;
  }

  public static async GetFreeWorkspaces(): Promise<string[]> {
    const result: string[] = [];
    const workspaces = await SharedWorkspaceLocking.GetAllWorkspaces();
    for (const element of workspaces) {
      if (!(await SharedWorkspaceLocking.IsWorkspaceLocked(element))) {
        result.push(element);
      }
    }

    return result;
  }

  public static async IsWorkspaceLocked(workspace: string): Promise<boolean> {
    if (!(await SharedWorkspaceLocking.DoesWorkspaceExist(workspace))) {
      return false;
    }
    const files = await SharedWorkspaceLocking.ReadLines(
      `aws s3 ls ${SharedWorkspaceLocking.workspaceRoot}${workspace}/`,
    );

    // 1 Because we expect 1 workspace file to exist in every workspace folder
    return files.length > 1;
  }

  public static async CreateWorkspace(workspace: string, lockId: string = ``) {
    if (lockId !== ``) {
      await SharedWorkspaceLocking.LockWorkspace(workspace, lockId);
    }

    const file = `${Date.now()}_workspace`;
    fs.writeFileSync(file, '');
    await CloudRunnerSystem.Run(
      `aws s3 cp ./${file} ${SharedWorkspaceLocking.workspaceRoot}${workspace}/${file}`,
      false,
      true,
    );
    fs.rmSync(file);

    return workspace;
  }

  public static async LockWorkspace(workspace: string, runId: string): Promise<boolean> {
    const file = `${Date.now()}_${runId}_lock`;
    fs.writeFileSync(file, '');
    await CloudRunnerSystem.Run(
      `aws s3 cp ./${file} ${SharedWorkspaceLocking.workspaceRoot}${workspace}/${file}`,
      false,
      true,
    );
    fs.rmSync(file);

    return SharedWorkspaceLocking.HasWorkspaceLock(workspace, runId);
  }

  public static async ReleaseWorkspace(workspace: string, runId: string): Promise<boolean> {
    if (!(await SharedWorkspaceLocking.DoesWorkspaceExist(workspace))) {
      return true;
    }
    const file = (await SharedWorkspaceLocking.GetAllLocks(workspace)).filter((x) => x.includes(`_${runId}_lock`));
    CloudRunnerLogger.log(`${JSON.stringify(await SharedWorkspaceLocking.GetAllLocks(workspace))}`);
    CloudRunnerLogger.log(`Deleting file ${file}`);
    CloudRunnerLogger.log(`aws s3 rm ${SharedWorkspaceLocking.workspaceRoot}${workspace}/${file}`);
    await CloudRunnerSystem.Run(`aws s3 rm ${SharedWorkspaceLocking.workspaceRoot}${workspace}/${file}`, false, true);

    return !SharedWorkspaceLocking.HasWorkspaceLock(workspace, runId);
  }

  public static async CleanupWorkspace(workspace: string) {
    await CloudRunnerSystem.Run(
      `aws s3 rm ${SharedWorkspaceLocking.workspaceRoot}${workspace} --recursive`,
      false,
      true,
    );
  }

  private static async ReadLines(command: string): Promise<string[]> {
    const result = await CloudRunnerSystem.Run(command, false, true);

    return result
      .split(`\n`)
      .map((x) => x.replace(`\r`, ``))
      .filter((x) => x !== ``)
      .map((x) => {
        const lineValues = x.split(` `);

        return lineValues[lineValues.length - 1];
      });
  }
}

export default SharedWorkspaceLocking;
