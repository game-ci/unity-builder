import SharedWorkspaceLocking from '../../cli/shared-workspace-locking';
import { Cli } from '../../cli/cli';

describe('Cloud Runner', () => {
  it('Locking', async () => {
    Cli.options = {
      retainWorkspaces: true,
    };
    await SharedWorkspaceLocking.IsWorkspaceLocked('test-workspace');
  });
});
