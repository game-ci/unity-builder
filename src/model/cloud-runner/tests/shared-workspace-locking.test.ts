import SharedWorkspaceLocking from '../../cli/shared-workspace-locking';
import { Cli } from '../../cli/cli';
import setups from './cloud-runner-suite.test';

describe('Cloud Runner Locking', () => {
  setups();
  it('Locking', async () => {
    Cli.options.retainWorkspaces = true;
    await SharedWorkspaceLocking.IsWorkspaceLocked('test-workspace');
  });
});
