import OrchestratorLogger from './orchestrator/services/core/orchestrator-logger';
import Orchestrator from './orchestrator/orchestrator';
import OrchestratorOptions from './orchestrator/options/orchestrator-options';
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
      auth: Orchestrator.buildParameters.gitPrivateToken,
    });
  }
  private static get sha() {
    return Orchestrator.buildParameters.gitSha;
  }

  private static get checkName() {
    return `Orchestrator (${Orchestrator.buildParameters.buildGuid})`;
  }

  private static get nameReadable() {
    return GitHub.checkName;
  }

  private static get checkRunId() {
    return Orchestrator.buildParameters.githubCheckId;
  }

  private static get owner() {
    return OrchestratorOptions.githubOwner;
  }

  private static get repo() {
    return OrchestratorOptions.githubRepoName;
  }

  public static async createGitHubCheck(summary: string) {
    if (!Orchestrator.buildParameters.githubChecks) {
      return ``;
    }
    GitHub.startedDate = new Date().toISOString();

    OrchestratorLogger.log(`Creating github check`);
    const data = {
      owner: GitHub.owner,
      repo: GitHub.repo,
      name: GitHub.checkName,
      // eslint-disable-next-line camelcase
      head_sha: GitHub.sha,
      status: 'queued',
      // eslint-disable-next-line camelcase
      external_id: Orchestrator.buildParameters.buildGuid,
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

    OrchestratorLogger.log(`Creating github check ${result.status}`);

    return result.data.id.toString();
  }

  public static async updateGitHubCheck(
    longDescription: string,
    summary: string,
    result = `neutral`,
    status = `in_progress`,
  ) {
    if (`${Orchestrator.buildParameters.githubChecks}` !== `true`) {
      return;
    }
    OrchestratorLogger.log(
      `githubChecks: ${Orchestrator.buildParameters.githubChecks} checkRunId: ${GitHub.checkRunId} sha: ${GitHub.sha} async: ${Orchestrator.isOrchestratorAsyncEnvironment}`,
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

    await (Orchestrator.isOrchestratorAsyncEnvironment || GitHub.forceAsyncTest
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
    OrchestratorLogger.log(`Got ${workflows.length} workflows`);
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
      ref: OrchestratorOptions.branch,
      inputs: {
        checksObject: JSON.stringify({ data, mode }),
      },
    });
  }

  static async triggerWorkflowOnComplete(triggerWorkflowOnComplete: string[]) {
    const isLocalAsync = Orchestrator.buildParameters.asyncWorkflow && !Orchestrator.isOrchestratorAsyncEnvironment;
    if (isLocalAsync || triggerWorkflowOnComplete === undefined || triggerWorkflowOnComplete.length === 0) {
      return;
    }
    try {
      const workflowsResult = await GitHub.octokitPAT.request(`GET /repos/{owner}/{repo}/actions/workflows`, {
        owner: GitHub.owner,
        repo: GitHub.repo,
      });
      const workflows = workflowsResult.data.workflows;
      OrchestratorLogger.log(`Got ${workflows.length} workflows`);
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
          ref: OrchestratorOptions.branch,
          inputs: {
            buildGuid: Orchestrator.buildParameters.buildGuid,
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
