import { GitRepoReader } from './git-repo';
import { OrchestratorSystem } from '../orchestrator/services/core/orchestrator-system';
import OrchestratorOptions from '../orchestrator/options/orchestrator-options';

describe(`git repo tests`, () => {
  it(`Branch value parsed from CLI to not contain illegal characters`, async () => {
    expect(await GitRepoReader.GetBranch()).not.toContain(`\n`);
    expect(await GitRepoReader.GetBranch()).not.toContain(` `);
  });

  it(`returns valid branch name when using https`, async () => {
    const mockValue = 'https://github.com/example/example.git';
    await jest.spyOn(OrchestratorSystem, 'Run').mockReturnValue(Promise.resolve(mockValue));
    await jest.spyOn(OrchestratorOptions, 'providerStrategy', 'get').mockReturnValue('not-local');
    expect(await GitRepoReader.GetRemote()).toEqual(`example/example`);
  });

  it(`returns valid branch name when using ssh`, async () => {
    const mockValue = 'git@github.com:example/example.git';
    await jest.spyOn(OrchestratorSystem, 'Run').mockReturnValue(Promise.resolve(mockValue));
    await jest.spyOn(OrchestratorOptions, 'providerStrategy', 'get').mockReturnValue('not-local');
    expect(await GitRepoReader.GetRemote()).toEqual(`example/example`);
  });
});
