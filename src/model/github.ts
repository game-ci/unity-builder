import { Octokit } from '@octokit/core';
import CloudRunnerLogger from './cloud-runner/services/cloud-runner-logger';
import CloudRunner from './cloud-runner/cloud-runner';
import CloudRunnerOptions from './cloud-runner/cloud-runner-options';

class GitHub {
  public static githubInputEnabled: boolean = true;
  private static longDescriptionContent = ``;
  private static startedDate;

  public static async createGitHubCheck(summary) {
    if (!CloudRunnerOptions.githubChecksEnabled) {
      return ``;
    }
    const sha = CloudRunner.buildParameters.gitSha;
    const name = `Cloud Runner (${CloudRunner.buildParameters.buildGuid})`;
    const nameReadable = name;
    const token = CloudRunner.buildParameters.gitPrivateToken;
    const owner = CloudRunnerOptions.githubOwner;
    const repo = CloudRunnerOptions.githubRepoName;
    GitHub.startedDate = Date.now();

    // call github api to create a check
    const octokit = new Octokit({
      auth: process.env.CHECKS_API_TOKEN || token,
    });

    CloudRunnerLogger.log(`POST /repos/${owner}/${repo}/check-runs`);

    const result = await octokit.request(`POST /repos/${owner}/${repo}/check-runs`, {
      owner,
      repo,
      name,
      // eslint-disable-next-line camelcase
      head_sha: sha,
      status: 'in_progress',
      // eslint-disable-next-line camelcase
      external_id: CloudRunner.buildParameters.buildGuid,
      // eslint-disable-next-line camelcase
      started_at: GitHub.startedDate,
      output: {
        title: nameReadable,
        summary,
        text: '',
      },
    });

    return result.data.id;
  }

  public static async updateGitHubCheck(summary, longDescription, result = `in_progress`, status = `completed`) {
    if (!CloudRunnerOptions.githubChecksEnabled) {
      return;
    }
    GitHub.longDescriptionContent += `\n${longDescription}`;
    const sha = CloudRunner.buildParameters.gitSha;
    const name = `Cloud Runner (${CloudRunner.buildParameters.buildGuid})`;
    const nameReadable = name;
    const token = CloudRunner.buildParameters.gitPrivateToken;
    const checkRunId = CloudRunner.githubCheckId;
    const owner = CloudRunnerOptions.githubOwner;
    const repo = CloudRunnerOptions.githubRepoName;
    const octokit = new Octokit({
      auth: process.env.GITHUB_CHECK_TOKEN || token,
    });

    const data: any = {
      owner,
      repo,
      // eslint-disable-next-line camelcase
      check_run_id: checkRunId,
      name,
      // eslint-disable-next-line camelcase
      head_sha: sha,
      // eslint-disable-next-line camelcase
      started_at: GitHub.startedDate,
      status,
      conclusion: result,
      // eslint-disable-next-line camelcase
      completed_at: '2018-05-04T01:14:52Z',
      output: {
        title: nameReadable,
        summary,
        text: GitHub.longDescriptionContent,
        annotations: [],
        images: [
          {
            alt: 'Game-CI',
            // eslint-disable-next-line camelcase
            image_url: 'https://game.ci/assets/images/game-ci-brand-logo-wordmark.svg',
          },
        ],
      },
    };

    await octokit.request(`PATCH /repos/${owner}/${repo}/check-runs/${checkRunId}`, data);
  }
}

export default GitHub;
