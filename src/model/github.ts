import CloudRunnerLogger from './cloud-runner/services/core/cloud-runner-logger';
import CloudRunner from './cloud-runner/cloud-runner';
import CloudRunnerOptions from './cloud-runner/options/cloud-runner-options';
import * as core from '@actions/core';
import { Octokit } from '@octokit/core';

class GitHub {
  private static readonly asyncChecksApiWorkflowName = `Async Checks API`;
  public static githubInputEnabled: boolean = true;
  private static longDescriptionContent: string = ``;
  private static startedDate: string;
  private static endedDate: string;
  static result: string = ``;
  static forceAsyncTest: boolean;
  private static get octokitDefaultToken() {
    return new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
  }
  private static get octokitPAT() {
    return new Octokit({
      auth: CloudRunner.buildParameters.gitPrivateToken,
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
    return CloudRunner.buildParameters.githubCheckId;
  }

  private static get owner() {
    return CloudRunnerOptions.githubOwner;
  }

  private static get repo() {
    return CloudRunnerOptions.githubRepoName;
  }

  public static async createGitHubCheck(summary: string) {
    if (!CloudRunner.buildParameters.githubChecks) {
      return ``;
    }
    GitHub.startedDate = new Date().toISOString();

    CloudRunnerLogger.log(`Creating github check`);
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
    const result = await GitHub.createGitHubCheckRequest(data);

    CloudRunnerLogger.log(`Creating github check ${result.status}`);

    return result.data.id.toString();
  }

  public static async updateGitHubCheck(
    longDescription: string,
    summary: string,
    result = `neutral`,
    status = `in_progress`,
  ) {
    if (`${CloudRunner.buildParameters.githubChecks}` !== `true`) {
      return;
    }
    CloudRunnerLogger.log(
      `githubChecks: ${CloudRunner.buildParameters.githubChecks} checkRunId: ${GitHub.checkRunId} sha: ${GitHub.sha} async: ${CloudRunner.isCloudRunnerAsyncEnvironment}`,
    );
    GitHub.longDescriptionContent += `\n${longDescription}`;
    if (GitHub.result !== `success` && GitHub.result !== `failure`) {
      GitHub.result = result;
    } else {
      result = GitHub.result;
    }
    const data: any = {
      owner: GitHub.owner,
      repo: GitHub.repo,
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

    await (CloudRunner.isCloudRunnerAsyncEnvironment || GitHub.forceAsyncTest
      ? GitHub.runUpdateAsyncChecksWorkflow(data, `update`)
      : GitHub.updateGitHubCheckRequest(data));
  }

  public static async updateGitHubCheckRequest(data: any) {
    return await GitHub.octokitDefaultToken.request(`PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}`, data);
  }

  public static async createGitHubCheckRequest(data: any) {
    return await GitHub.octokitDefaultToken.request(`POST /repos/{owner}/{repo}/check-runs`, data);
  }

  public static async runUpdateAsyncChecksWorkflow(data: any, mode: string) {
    if (mode === `create`) {
      throw new Error(`Not supported: only use update`);
    }
    const workflowsResult = await GitHub.octokitPAT.request(`GET /repos/{owner}/{repo}/actions/workflows`, {
      owner: GitHub.owner,
      repo: GitHub.repo,
    });
    const workflows = workflowsResult.data.workflows;
    CloudRunnerLogger.log(`Got ${workflows.length} workflows`);
    let selectedId = ``;
    for (let index = 0; index < workflowsResult.data.total_count; index++) {
      if (workflows[index].name === GitHub.asyncChecksApiWorkflowName) {
        selectedId = workflows[index].id.toString();
      }
    }
    if (selectedId === ``) {
      core.info(JSON.stringify(workflows));
      throw new Error(`no workflow with name "${GitHub.asyncChecksApiWorkflowName}"`);
    }
    await GitHub.octokitPAT.request(`POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches`, {
      owner: GitHub.owner,
      repo: GitHub.repo,
      // eslint-disable-next-line camelcase
      workflow_id: selectedId,
      ref: CloudRunnerOptions.branch,
      inputs: {
        checksObject: JSON.stringify({ data, mode }),
      },
    });
  }

  static async triggerWorkflowOnComplete(triggerWorkflowOnComplete: string[]) {
    const isLocalAsync = CloudRunner.buildParameters.asyncWorkflow && !CloudRunner.isCloudRunnerAsyncEnvironment;
    if (isLocalAsync || triggerWorkflowOnComplete === undefined || triggerWorkflowOnComplete.length === 0) {
      return;
    }
    try {
      const workflowsResult = await GitHub.octokitPAT.request(`GET /repos/{owner}/{repo}/actions/workflows`, {
        owner: GitHub.owner,
        repo: GitHub.repo,
      });
      const workflows = workflowsResult.data.workflows;
      CloudRunnerLogger.log(`Got ${workflows.length} workflows`);
      for (const element of triggerWorkflowOnComplete) {
        let selectedId = ``;
        for (let index = 0; index < workflowsResult.data.total_count; index++) {
          if (workflows[index].name === element) {
            selectedId = workflows[index].id.toString();
          }
        }
        if (selectedId === ``) {
          core.info(JSON.stringify(workflows));
          throw new Error(`no workflow with name "${GitHub.asyncChecksApiWorkflowName}"`);
        }
        await GitHub.octokitPAT.request(`POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches`, {
          owner: GitHub.owner,
          repo: GitHub.repo,
          // eslint-disable-next-line camelcase
          workflow_id: selectedId,
          ref: CloudRunnerOptions.branch,
          inputs: {
            buildGuid: CloudRunner.buildParameters.buildGuid,
          },
        });
      }
    } catch {
      core.info(`github workflow complete hook not found`);
    }
  }

  public static async getCheckStatus() {
    return await GitHub.octokitDefaultToken.request(`GET /repos/{owner}/{repo}/check-runs/{check_run_id}`);
  }
}

export default GitHub;
