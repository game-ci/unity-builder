import { Octokit } from '@octokit/core';
import CloudRunnerLogger from './cloud-runner/services/cloud-runner-logger';

class GitHub {
  public static githubInputEnabled: boolean = true;

  public static async updateGitHubCheck(owner, repo, token, name, sha, nameReadable, summary, longDescription) {
    const octokit = new Octokit({
      auth: token,
    });

    const checkRunId = 0;

    const data: any = {
      owner,
      repo,
      // eslint-disable-next-line camelcase
      check_run_id: checkRunId,
      name,
      // eslint-disable-next-line camelcase
      head_sha: sha,
      // eslint-disable-next-line camelcase
      started_at: '2018-05-04T01:14:52Z',
      status: `completed`,
      conclusion: 'success',
      // eslint-disable-next-line camelcase
      completed_at: '2018-05-04T01:14:52Z',
      output: {
        title: nameReadable,
        summary,
        text: longDescription,
        annotations: [],
        images: [
          {
            alt: 'Super bananas',
            // eslint-disable-next-line camelcase
            image_url: 'http://example.com/images/42',
          },
        ],
      },
    };

    await octokit.request(`PATCH /repos/${owner}/${repo}/check-runs/${checkRunId}`, data);
  }

  public static async createGitHubCheck(owner, repo, token, name, sha, nameReadable, summary) {
    // call github api to create a check
    const octokit = new Octokit({
      auth: token,
    });

    CloudRunnerLogger.log(`POST /repos/${owner}/${repo}/check-runs`);

    await octokit.request(`POST /repos/${owner}/${repo}/check-runs`, {
      owner,
      repo,
      name,
      // eslint-disable-next-line camelcase
      head_sha: sha,
      status: 'in_progress',
      // eslint-disable-next-line camelcase
      external_id: '42',
      // eslint-disable-next-line camelcase
      started_at: '2018-05-04T01:14:52Z',
      output: {
        title: nameReadable,
        summary,
        text: '',
      },
    });
  }
}

export default GitHub;
