import { GithubCliReader } from './github-cli';
import * as core from '@actions/core';

describe(`github cli`, () => {
  it(`returns`, async () => {
    const token = await GithubCliReader.GetGitHubAuthToken();
    core.info(token);
  });
});
