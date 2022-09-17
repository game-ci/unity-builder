import { CloudRunnerSystem } from '../cloud-runner/services/cloud-runner-system';
import * as fs from 'fs';
import CloudRunner from '../cloud-runner/cloud-runner';
export class SharedWorkspaceLocking {
  public static async GetLockedWorkspace() {
    const workspaces = SharedWorkspaceLocking.GetFreeWorkspaces();
    for (const element of workspaces) {
      if (await SharedWorkspaceLocking.LockWorkspace(element)) {
        return element;
      }
    }

    return;
  }

  public static GetFreeWorkspaces(): string[] {
    return ['test-workspace'];
  }
  public static GetAllWorkspaces(): string[] {
    return [];
  }
  public static async LockWorkspace(workspace: string): Promise<boolean> {
    // this job + date
    const file = `_lock_${CloudRunner.buildParameters.buildGuid}_${Date.now()}`;
    fs.writeFileSync(file, '');
    await CloudRunnerSystem.Run(`aws s3 cp ./${file} s3://game-ci-test-storage/locks/${workspace}/${file}`);
    fs.rmSync(file);

    return SharedWorkspaceLocking.HasWorkspaceLock(workspace);
  }
  public static async HasWorkspaceLock(workspace: string): Promise<boolean> {
    await CloudRunnerSystem.Run(`aws s3 ls s3://game-ci-test-storage/locks/${workspace}`);

    return true;
  }
  // eslint-disable-next-line no-unused-vars
  public static IsWorkspaceLocked(workspace: string) {}
  // eslint-disable-next-line no-unused-vars
  public static CreateLockableWorkspace(workspace: string, locked: boolean = false) {}
  // eslint-disable-next-line no-unused-vars
  public static ReleaseLock(workspace: string) {}
}

export default SharedWorkspaceLocking;
