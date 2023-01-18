import CloudRunnerLogger from './cloud-runner/services/cloud-runner-logger';
import CloudRunner from './cloud-runner/cloud-runner';
import CloudRunnerOptions from './cloud-runner/cloud-runner-options';
import { Octokit } from '@octokit/core';
class GitHub {
  public static githubInputEnabled: boolean = true;
  private static longDescriptionContent: string = ``;
  private static startedDate: string;
  private static endedDate: string;
  private static get octokit() {
    return new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
  }
  private static get sha() {
    return CloudRunner.buildParameters.gitSha;
  }

  private static get checkName() {
    return `Cloud Runner (${CloudRunner.buildParameters.buildGuid})`;
  }

  private static get nameReadable() {
    return GitHub.checkName;
  }

  private static get checkRunId() {
    return CloudRunner.githubCheckId;
  }

  private static get owner() {
    return CloudRunnerOptions.githubOwner;
  }

  private static get repo() {
    return CloudRunnerOptions.githubRepoName;
  }

  public static async createGitHubCheck(summary) {
    if (!CloudRunnerOptions.githubChecks) {
      return ``;
    }
    GitHub.startedDate = new Date().toISOString();

    CloudRunnerLogger.log(`POST /repos/${GitHub.owner}/${GitHub.repo}/check-runs`);

    const data = {
      owner: GitHub.owner,
      repo: GitHub.repo,
      name: GitHub.checkName,
      // eslint-disable-next-line camelcase
      head_sha: GitHub.sha,
      status: 'queued',
      // eslint-disable-next-line camelcase
      external_id: CloudRunner.buildParameters.buildGuid,
      // eslint-disable-next-line camelcase
      started_at: GitHub.startedDate,
      output: {
        title: GitHub.nameReadable,
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
    };

    if (await CloudRunnerOptions.asyncCloudRunner) {
      await GitHub.runUpdateAsyncChecksWorkflow(data, `update`);

      return;
    }
    const result = await GitHub.octokit.request(`POST /repos/${GitHub.owner}/${GitHub.repo}/check-runs`, data);

    return result.data.id;
  }

  public static async runUpdateAsyncChecksWorkflow(data, mode) {
    const workflowsResult = await GitHub.octokit.request(
      `GET /repos/${GitHub.owner}/${GitHub.repo}/actions/workflows`,
      {
        owner: GitHub.owner,
        repo: GitHub.repo,
      },
    );
    const workflows = workflowsResult.data.workflows;
    let selectedId = ``;
    for (let index = 0; index < workflowsResult.data.total_count; index++) {
      if (workflows[index].name === `Async Checks API`) {
        selectedId = workflows[index].id;
      }
    }
    if (selectedId === ``) {
      throw new Error(`no workflow with name "Async Checks API"`);
    }
    await GitHub.octokit.request(`POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches`, {
      owner: GitHub.owner,
      repo: GitHub.repo,
      // eslint-disable-next-line camelcase
      workflow_id: selectedId,
      ref: 'topic-branch',
      inputs: {
        checksObject: JSON.stringify({ data, mode }),
      },
    });
  }

  public static async updateGitHubCheck(longDescription, summary, result = `neutral`, status = `in_progress`) {
    if (!CloudRunnerOptions.githubChecks) {
      return;
    }
    GitHub.longDescriptionContent += `\n${longDescription}`;

    const data: any = {
      owner: GitHub.owner,
      repo: GitHub.owner,
      // eslint-disable-next-line camelcase
      check_run_id: GitHub.checkRunId,
      name: GitHub.checkName,
      // eslint-disable-next-line camelcase
      head_sha: GitHub.sha,
      // eslint-disable-next-line camelcase
      started_at: GitHub.startedDate,
      status,
      output: {
        title: GitHub.nameReadable,
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

    if (await CloudRunnerOptions.asyncCloudRunner) {
      await GitHub.runUpdateAsyncChecksWorkflow(data, `update`);

      return;
    }
    await GitHub.octokit.request(`PATCH /repos/${GitHub.owner}/${GitHub.repo}/check-runs/${GitHub.checkRunId}`, data);
  }
}

export default GitHub;
