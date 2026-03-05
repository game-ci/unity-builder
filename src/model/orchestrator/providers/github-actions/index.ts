import BuildParameters from '../../../build-parameters';
import { OrchestratorSystem } from '../../services/core/orchestrator-system';
import OrchestratorEnvironmentVariable from '../../options/orchestrator-environment-variable';
import OrchestratorLogger from '../../services/core/orchestrator-logger';
import { ProviderInterface } from '../provider-interface';
import OrchestratorSecret from '../../options/orchestrator-secret';
import { ProviderResource } from '../provider-resource';
import { ProviderWorkflow } from '../provider-workflow';

/**
 * GitHub Actions provider — triggers builds as workflow_dispatch events
 * on a target repository via the GitHub API.
 *
 * Use case: Distribute builds across orgs, use specialized runner pools,
 * or trigger builds in repos with Unity licenses.
 */
class GitHubActionsProvider implements ProviderInterface {
  private buildParameters: BuildParameters;
  private repo: string;
  private workflow: string;
  private token: string;
  private ref: string;
  private runId: number = 0;

  constructor(buildParameters: BuildParameters) {
    this.buildParameters = buildParameters;
    this.repo = buildParameters.githubActionsRepo || '';
    this.workflow = buildParameters.githubActionsWorkflow || '';
    this.token = buildParameters.githubActionsToken || '';
    this.ref = buildParameters.githubActionsRef || 'main';
  }

  async setupWorkflow(
    // eslint-disable-next-line no-unused-vars
    buildGuid: string,
    // eslint-disable-next-line no-unused-vars
    buildParameters: BuildParameters,
    // eslint-disable-next-line no-unused-vars
    branchName: string,
    // eslint-disable-next-line no-unused-vars
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ): Promise<void> {
    OrchestratorLogger.log(`[GitHubActions] Setting up workflow dispatch to ${this.repo}`);

    if (!this.repo || !this.workflow) {
      throw new Error('githubActionsRepo and githubActionsWorkflow are required for the github-actions provider');
    }

    if (!this.token) {
      throw new Error('githubActionsToken is required (PAT with actions:write scope)');
    }

    // Verify repository and workflow exist
    try {
      const result = await OrchestratorSystem.Run(
        `GH_TOKEN=${this.token} gh api repos/${this.repo}/actions/workflows/${this.workflow} --jq '.id'`,
      );
      OrchestratorLogger.log(`[GitHubActions] Workflow verified: ${this.workflow} (ID: ${result.trim()})`);
    } catch (error: any) {
      throw new Error(`Failed to verify workflow ${this.workflow} in ${this.repo}: ${error.message || error}`);
    }
  }

  async runTaskInWorkflow(
    buildGuid: string,
    image: string,
    commands: string,
    mountdir: string,
    workingdir: string,
    environment: OrchestratorEnvironmentVariable[],
    // eslint-disable-next-line no-unused-vars
    secrets: OrchestratorSecret[],
  ): Promise<string> {
    OrchestratorLogger.log(`[GitHubActions] Dispatching workflow ${this.workflow} on ${this.repo}@${this.ref}`);

    // Build inputs payload
    const inputs: Record<string, string> = {
      buildGuid,
      image,
      commands: Buffer.from(commands).toString('base64'),
      mountdir,
      workingdir,
    };

    // Add environment variables as a JSON input
    if (environment.length > 0) {
      inputs.environment = JSON.stringify(environment.map((element) => ({ name: element.name, value: element.value })));
    }

    // Record the time before dispatch to identify the run
    const beforeDispatch = new Date().toISOString();

    // Dispatch the workflow
    const inputsJson = JSON.stringify(inputs).replace(/'/g, "'\\''");
    try {
      await OrchestratorSystem.Run(
        `GH_TOKEN=${this.token} gh api repos/${this.repo}/actions/workflows/${this.workflow}/dispatches -X POST -f ref='${this.ref}' -f "inputs=${inputsJson}"`,
      );
      OrchestratorLogger.log(`[GitHubActions] Workflow dispatched`);
    } catch (error: any) {
      throw new Error(`Failed to dispatch workflow: ${error.message || error}`);
    }

    // Poll for the run to appear
    OrchestratorLogger.log(`[GitHubActions] Waiting for workflow run to start...`);
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 10_000));

      try {
        const runsJson = await OrchestratorSystem.Run(
          `GH_TOKEN=${this.token} gh api "repos/${this.repo}/actions/workflows/${this.workflow}/runs?created=>${beforeDispatch}&per_page=5" --jq '.workflow_runs[0] | {id, status, conclusion}'`,
          true,
        );

        const run = JSON.parse(runsJson.trim());
        if (run.id) {
          this.runId = run.id;
          OrchestratorLogger.log(`[GitHubActions] Run started: ${this.runId} (status: ${run.status})`);
          break;
        }
      } catch {
        // Run not yet available
      }
    }

    if (!this.runId) {
      throw new Error(`Workflow run did not start within ${maxAttempts * 10}s`);
    }

    // Poll until completion and stream logs
    let status = 'in_progress';
    while (status === 'in_progress' || status === 'queued') {
      await new Promise((resolve) => setTimeout(resolve, 15_000));

      try {
        const statusJson = await OrchestratorSystem.Run(
          `GH_TOKEN=${this.token} gh api repos/${this.repo}/actions/runs/${this.runId} --jq '{status, conclusion}'`,
          true,
        );

        const result = JSON.parse(statusJson.trim());
        status = result.status;

        if (status === 'completed') {
          OrchestratorLogger.log(`[GitHubActions] Run ${this.runId} completed: ${result.conclusion}`);

          if (result.conclusion !== 'success') {
            throw new Error(`Workflow run failed with conclusion: ${result.conclusion}`);
          }

          break;
        }

        OrchestratorLogger.log(`[GitHubActions] Run ${this.runId} status: ${status}`);
      } catch (error: any) {
        if (error.message && error.message.includes('conclusion')) {
          throw error;
        }
        OrchestratorLogger.logWarning(`[GitHubActions] Status check error: ${error.message || error}`);
      }
    }

    // Fetch logs
    try {
      const logs = await OrchestratorSystem.Run(
        `GH_TOKEN=${this.token} gh run view ${this.runId} --repo ${this.repo} --log`,
        true,
      );

      return logs;
    } catch {
      return `Run ${this.runId} completed successfully (logs unavailable)`;
    }
  }

  async cleanupWorkflow(
    // eslint-disable-next-line no-unused-vars
    buildParameters: BuildParameters,
    // eslint-disable-next-line no-unused-vars
    branchName: string,
    // eslint-disable-next-line no-unused-vars
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ): Promise<void> {
    OrchestratorLogger.log(`[GitHubActions] Cleanup complete (no resources to tear down)`);
  }

  async garbageCollect(
    // eslint-disable-next-line no-unused-vars
    filter: string,
    // eslint-disable-next-line no-unused-vars
    previewOnly: boolean,
    // eslint-disable-next-line no-unused-vars
    olderThan: Number,
    // eslint-disable-next-line no-unused-vars
    fullCache: boolean,
    // eslint-disable-next-line no-unused-vars
    baseDependencies: boolean,
  ): Promise<string> {
    return '';
  }

  async listResources(): Promise<ProviderResource[]> {
    if (!this.repo || !this.token) return [];

    try {
      const runnersJson = await OrchestratorSystem.Run(
        `GH_TOKEN=${this.token} gh api repos/${this.repo}/actions/runners --jq '.runners[] | .name'`,
        true,
      );

      return runnersJson
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((name) => {
          const resource = new ProviderResource();
          resource.Name = name.trim();

          return resource;
        });
    } catch {
      return [];
    }
  }

  async listWorkflow(): Promise<ProviderWorkflow[]> {
    if (!this.repo || !this.token) return [];

    try {
      const runsJson = await OrchestratorSystem.Run(
        `GH_TOKEN=${this.token} gh api repos/${this.repo}/actions/runs?per_page=10 --jq '.workflow_runs[] | .name'`,
        true,
      );

      return runsJson
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((name) => {
          const workflow = new ProviderWorkflow();
          workflow.Name = name.trim();

          return workflow;
        });
    } catch {
      return [];
    }
  }

  async watchWorkflow(): Promise<string> {
    if (!this.runId) return 'No active run to watch';

    try {
      return await OrchestratorSystem.Run(
        `GH_TOKEN=${this.token} gh run watch ${this.runId} --repo ${this.repo}`,
        true,
      );
    } catch {
      return '';
    }
  }
}
export default GitHubActionsProvider;
