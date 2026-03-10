import { GitRepoReader } from './git-repo';
import Input from '../input';

describe(`git repo tests`, () => {
  it(`Branch value parsed from CLI to not contain illegal characters`, async () => {
    expect(await GitRepoReader.GetBranch()).not.toContain(`\n`);
    expect(await GitRepoReader.GetBranch()).not.toContain(` `);
  });

  it(`returns valid branch name when using https`, async () => {
    const mockValue = 'https://github.com/example/example.git';
    jest.spyOn(GitRepoReader as any, 'runCommand').mockResolvedValue(mockValue);
    jest.spyOn(Input, 'getInput').mockReturnValue('not-local');
    expect(await GitRepoReader.GetRemote()).toEqual(`example/example`);
  });

  it(`returns valid branch name when using ssh`, async () => {
    const mockValue = 'git@github.com:example/example.git';
    jest.spyOn(GitRepoReader as any, 'runCommand').mockResolvedValue(mockValue);
    jest.spyOn(Input, 'getInput').mockReturnValue('not-local');
    expect(await GitRepoReader.GetRemote()).toEqual(`example/example`);
  });
});
