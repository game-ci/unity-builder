import { GitRepoReader } from './git-repo.ts';

describe(`git repo tests`, () => {
  it(`Branch value parsed from CLI to not contain illegal characters`, async () => {
    expect(await GitRepoReader.GetBranch()).not.toContain(`\n`);
    expect(await GitRepoReader.GetBranch()).not.toContain(` `);
  });
});
