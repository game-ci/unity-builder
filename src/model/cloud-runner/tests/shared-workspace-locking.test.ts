import SharedWorkspaceLocking from '../../cli/shared-workspace-locking';

describe('Cloud Runner', () => {
  it('Locking', async () => {
    await SharedWorkspaceLocking.IsWorkspaceLocked('test-workspace');
  });
});
