import CloudRunnerLogger from './cloud-runner/services/cloud-runner-logger';
import CloudRunner from './cloud-runner/cloud-runner';
import CloudRunnerOptions from './cloud-runner/cloud-runner-options';
import { Octokit } from '@octokit/core';
class GitHub {
  public static githubInputEnabled: boolean = true;
  private static longDescriptionContent: string = ``;
  private static startedDate: string;
  private static endedDate: string;

  public static async createGitHubCheck(summary) {
    if (!CloudRunnerOptions.githubChecks || CloudRunnerOptions.asyncCloudRunner) {
      return ``;
    }
    const sha = CloudRunner.buildParameters.gitSha;
    const name = `Cloud Runner (${CloudRunner.buildParameters.buildGuid})`;
    const nameReadable = name;
    const token = CloudRunner.buildParameters.gitPrivateToken;
    const owner = CloudRunnerOptions.githubOwner;
    const repo = CloudRunnerOptions.githubRepoName;
    GitHub.startedDate = new Date().toISOString();

    // call github api to create a check
    const octokit = new Octokit({
      auth: token,
    });

    CloudRunnerLogger.log(`POST /repos/${owner}/${repo}/check-runs`);

    const result = await octokit.request(`POST /repos/${owner}/${repo}/check-runs`, {
      owner,
      repo,
      name,
      // eslint-disable-next-line camelcase
      head_sha: sha,
      status: 'queued',
      // eslint-disable-next-line camelcase
      external_id: CloudRunner.buildParameters.buildGuid,
      // eslint-disable-next-line camelcase
      started_at: GitHub.startedDate,
      output: {
        title: nameReadable,
        summary,
        text: '',
        images: [
          {
            alt: 'Game-CI',
            // eslint-disable-next-line camelcase
            image_url: 'https://game.ci/assets/images/game-ci-brand-logo-wordmark.svg',
          },
        ],
      },
    });

    return result.data.id;
  }

  public static async updateGitHubCheck(longDescription, summary, result = `neutral`, status = `in_progress`) {
    if (!CloudRunnerOptions.githubChecks || CloudRunnerOptions.asyncCloudRunner) {
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
      auth: token,
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
      output: {
        title: nameReadable,
        summary,
        text: GitHub.longDescriptionContent,
        annotations: [],
      },
    };

    if (status === `completed`) {
      if (GitHub.endedDate !== undefined) {
        GitHub.endedDate = new Date().toISOString();
      }
      // eslint-disable-next-line camelcase
      data.completed_at = GitHub.endedDate || GitHub.startedDate;
      data.conclusion = result;
    }

    await octokit.request(`PATCH /repos/${owner}/${repo}/check-runs/${checkRunId}`, data);
  }
}

export default GitHub;
