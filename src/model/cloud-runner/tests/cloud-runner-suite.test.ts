import { Cli } from '../../cli/cli';
import GitHub from '../../github';

describe('Cloud Runner', () => {
  it('Responds', () => {});
});

const setups = () => {
  beforeAll(() => {
    GitHub.githubInputEnabled = false;
  });
  beforeEach(() => {
    Cli.options = {};
  });
  afterEach(() => {
    if (Cli.options !== undefined) {
      delete Cli.options;
    }
  });
  afterAll(() => {
    GitHub.githubInputEnabled = true;
  });
};

export default setups;
