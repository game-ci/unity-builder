import { GitRepoReader } from './git-repo';
import { CloudRunnerSystem } from '../cloud-runner/services/cloud-runner-system';
import CloudRunnerOptions from '../cloud-runner/cloud-runner-options';

describe(`git repo tests`, () => {
  it(`Branch value parsed from CLI to not contain illegal characters`, async () => {
    expect(await GitRepoReader.GetBranch()).not.toContain(`\n`);
    expect(await GitRepoReader.GetBranch()).not.toContain(` `);
  });

  it(`returns valid branch name when using https`, async () => {
    const mockValue = 'https://github.com/example/example.git';
    await jest.spyOn(CloudRunnerSystem, 'Run').mockReturnValue(Promise.resolve(mockValue));
    await jest.spyOn(CloudRunnerOptions, 'cloudRunnerCluster', 'get').mockReturnValue('not-local');
    expect(await GitRepoReader.GetRemote()).toEqual(`example/example`);
  });

  it(`returns valid branch name when using ssh`, async () => {
    const mockValue = 'git@github.com:example/example.git';
    await jest.spyOn(CloudRunnerSystem, 'Run').mockReturnValue(Promise.resolve(mockValue));
    await jest.spyOn(CloudRunnerOptions, 'cloudRunnerCluster', 'get').mockReturnValue('not-local');
    expect(await GitRepoReader.GetRemote()).toEqual(`example/example`);
  });
});
