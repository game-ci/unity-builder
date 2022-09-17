import { Cli } from '../../cli/cli';
import GitHub from '../../github';
describe('Cloud Runner', () => {
  it('Responds', () => {});
  beforeAll(() => {
    GitHub.githubInputEnabled = false;
  });
  afterEach(() => {
    if (Cli.options === undefined) {
      delete Cli.options;
    }
  });
  afterAll(() => {
    GitHub.githubInputEnabled = true;
  });
});
