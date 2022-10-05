import SharedWorkspaceLocking from '../../cli/shared-workspace-locking';
import { Cli } from '../../cli/cli';
import setups from './cloud-runner-suite.test';
import CloudRunnerLogger from '../services/cloud-runner-logger';
import { v4 as uuidv4 } from 'uuid';
import CloudRunnerOptions from '../cloud-runner-options';

describe('Cloud Runner Locking', () => {
  setups();
  it('Responds', () => {});
  if (CloudRunnerOptions.cloudRunnerTests) {
    it(`Simple Locking Flow`, async () => {
      Cli.options.retainWorkspaces = true;
      const newWorkspaceName = `test-workspace-${uuidv4()}`;
      const runId = uuidv4();
      await SharedWorkspaceLocking.CreateWorkspace(newWorkspaceName);
      const isExpectedUnlockedBeforeLocking =
        (await SharedWorkspaceLocking.IsWorkspaceLocked(newWorkspaceName)) === false;
      expect(isExpectedUnlockedBeforeLocking).toBeTruthy();
      await SharedWorkspaceLocking.LockWorkspace(newWorkspaceName, runId);
      const isExpectedLockedAfterLocking = (await SharedWorkspaceLocking.IsWorkspaceLocked(newWorkspaceName)) === true;
      expect(isExpectedLockedAfterLocking).toBeTruthy();
      const locksBeforeRelease = await SharedWorkspaceLocking.GetAllLocks(newWorkspaceName);
      CloudRunnerLogger.log(JSON.stringify(locksBeforeRelease, undefined, 4));
      expect(locksBeforeRelease.length > 1).toBeTruthy();
      await SharedWorkspaceLocking.ReleaseWorkspace(newWorkspaceName, runId);
      const locks = await SharedWorkspaceLocking.GetAllLocks(newWorkspaceName);
      expect(locks.length === 1).toBeTruthy();
      const isExpectedLockedAfterReleasing =
        (await SharedWorkspaceLocking.IsWorkspaceLocked(newWorkspaceName)) === false;
      expect(isExpectedLockedAfterReleasing).toBeTruthy();
    }, 150000);
    it('All Locking Actions', async () => {
      Cli.options.retainWorkspaces = true;
      CloudRunnerLogger.log(`GetAllWorkspaces ${JSON.stringify(await SharedWorkspaceLocking.GetAllWorkspaces())}`);
      CloudRunnerLogger.log(`GetFreeWorkspaces ${JSON.stringify(await SharedWorkspaceLocking.GetFreeWorkspaces())}`);
      CloudRunnerLogger.log(
        `IsWorkspaceLocked ${JSON.stringify(
          await SharedWorkspaceLocking.IsWorkspaceLocked(`test-workspace-${uuidv4()}`),
        )}`,
      );
      CloudRunnerLogger.log(`GetFreeWorkspaces ${JSON.stringify(await SharedWorkspaceLocking.GetFreeWorkspaces())}`);
      CloudRunnerLogger.log(
        `LockWorkspace ${JSON.stringify(
          await SharedWorkspaceLocking.LockWorkspace(`test-workspace-${uuidv4()}`, uuidv4()),
        )}`,
      );
      CloudRunnerLogger.log(
        `CreateLockableWorkspace ${JSON.stringify(
          await SharedWorkspaceLocking.CreateWorkspace(`test-workspace-${uuidv4()}`),
        )}`,
      );
      CloudRunnerLogger.log(
        `GetLockedWorkspace ${JSON.stringify(
          await SharedWorkspaceLocking.GetOrCreateLockedWorkspace(`test-workspace-${uuidv4()}`, uuidv4()),
        )}`,
      );
    }, 3000000);
  }
});
