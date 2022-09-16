export class SharedWorkspaceLocking {
  public static GetLockedWorkspace() {
    const workspaces = SharedWorkspaceLocking.GetFreeWorkspaces();
    for (const element of workspaces) {
      if (SharedWorkspaceLocking.LockWorkspace(element)) {
        return element;
      }
    }

    return;
  }

  public static GetFreeWorkspaces(): string[] {
    return [];
  }
  public static GetAllWorkspaces(): string[] {
    return [];
  }
  // eslint-disable-next-line no-unused-vars
  public static LockWorkspace(workspace: string): boolean {
    return true;
  }
  // eslint-disable-next-line no-unused-vars
  public static IsWorkspaceLocked(workspace: string) {}
  // eslint-disable-next-line no-unused-vars
  public static HasWorkspaceLock(workspace: string) {}
  // eslint-disable-next-line no-unused-vars
  public static CreateLockableWorkspace(workspace: string, locked: boolean = false) {}
  // eslint-disable-next-line no-unused-vars
  public static ReleaseLock(workspace: string) {}
}

export default SharedWorkspaceLocking;
