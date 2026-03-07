import BuildParameters from '../../../build-parameters';
import { OrchestratorSystem } from '../../services/core/orchestrator-system';
import OrchestratorEnvironmentVariable from '../../options/orchestrator-environment-variable';
import OrchestratorLogger from '../../services/core/orchestrator-logger';
import { ProviderInterface } from '../provider-interface';
import OrchestratorSecret from '../../options/orchestrator-secret';
import { ProviderResource } from '../provider-resource';
import { ProviderWorkflow } from '../provider-workflow';

/**
 * GitLab CI provider — triggers builds as GitLab CI pipelines
 * via the GitLab API.
 *
 * Use case: Teams using GitLab CI, hybrid GitHub/GitLab setups,
 * or GitLab runners with Unity licenses.
 */
class GitLabCIProvider implements ProviderInterface {
  private buildParameters: BuildParameters;
  private projectId: string;
  private triggerToken: string;
  private apiUrl: string;
  private ref: string;
  private pipelineId: number = 0;

  constructor(buildParameters: BuildParameters) {
    this.buildParameters = buildParameters;
    this.projectId = buildParameters.gitlabProjectId || '';
    this.triggerToken = buildParameters.gitlabTriggerToken || '';
    this.apiUrl = (buildParameters.gitlabApiUrl || 'https://gitlab.com').replace(/\/+$/, '');
    this.ref = buildParameters.gitlabRef || 'main';
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
    OrchestratorLogger.log(`[GitLabCI] Setting up pipeline trigger for project ${this.projectId}`);

    if (!this.projectId || !this.triggerToken) {
      throw new Error('gitlabProjectId and gitlabTriggerToken are required for the gitlab-ci provider');
    }

    // Verify project access
    const encodedProject = encodeURIComponent(this.projectId);
    try {
      await OrchestratorSystem.Run(
        `curl -sf -H "PRIVATE-TOKEN: ${this.triggerToken}" "${this.apiUrl}/api/v4/projects/${encodedProject}" -o /dev/null`,
      );
      OrchestratorLogger.log(`[GitLabCI] Project access verified`);
    } catch (error: any) {
      throw new Error(`Failed to access GitLab project ${this.projectId}: ${error.message || error}`);
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
    OrchestratorLogger.log(`[GitLabCI] Triggering pipeline on project ${this.projectId}@${this.ref}`);

    const encodedProject = encodeURIComponent(this.projectId);

    // Build variables for the pipeline
    const pipelineVariables: string[] = [
      `-f "variables[BUILD_GUID]=${buildGuid}"`,
      `-f "variables[BUILD_IMAGE]=${image}"`,
      `-f "variables[BUILD_COMMANDS]=${Buffer.from(commands).toString('base64')}"`,
      `-f "variables[MOUNT_DIR]=${mountdir}"`,
      `-f "variables[WORKING_DIR]=${workingdir}"`,
    ];

    for (const element of environment) {
      pipelineVariables.push(`-f "variables[${element.name}]=${element.value}"`);
    }

    // Trigger pipeline
    try {
      const response = await OrchestratorSystem.Run(
        `curl -sf -X POST "${this.apiUrl}/api/v4/projects/${encodedProject}/trigger/pipeline" -f "token=${
          this.triggerToken
        }" -f "ref=${this.ref}" ${pipelineVariables.join(' ')}`,
      );

      const pipeline = JSON.parse(response);
      this.pipelineId = pipeline.id;
      OrchestratorLogger.log(`[GitLabCI] Pipeline triggered: ${this.pipelineId} (status: ${pipeline.status})`);
    } catch (error: any) {
      throw new Error(`Failed to trigger pipeline: ${error.message || error}`);
    }

    // Poll until completion
    let status = 'pending';
    const terminalStatuses = new Set(['success', 'failed', 'canceled', 'skipped']);

    while (!terminalStatuses.has(status)) {
      await new Promise((resolve) => setTimeout(resolve, 15_000));

      try {
        const statusResponse = await OrchestratorSystem.Run(
          `curl -sf -H "PRIVATE-TOKEN: ${this.triggerToken}" "${this.apiUrl}/api/v4/projects/${encodedProject}/pipelines/${this.pipelineId}"`,
          true,
        );

        const pipelineStatus = JSON.parse(statusResponse);
        status = pipelineStatus.status;
        OrchestratorLogger.log(`[GitLabCI] Pipeline ${this.pipelineId} status: ${status}`);
      } catch (error: any) {
        OrchestratorLogger.logWarning(`[GitLabCI] Status check error: ${error.message || error}`);
      }
    }

    if (status !== 'success') {
      throw new Error(`Pipeline ${this.pipelineId} finished with status: ${status}`);
    }

    // Fetch job logs
    try {
      const jobsResponse = await OrchestratorSystem.Run(
        `curl -sf -H "PRIVATE-TOKEN: ${this.triggerToken}" "${this.apiUrl}/api/v4/projects/${encodedProject}/pipelines/${this.pipelineId}/jobs"`,
        true,
      );

      const jobs = JSON.parse(jobsResponse);
      const logs: string[] = [];

      for (const job of jobs) {
        try {
          const jobLog = await OrchestratorSystem.Run(
            `curl -sf -H "PRIVATE-TOKEN: ${this.triggerToken}" "${this.apiUrl}/api/v4/projects/${encodedProject}/jobs/${job.id}/trace"`,
            true,
          );
          logs.push(`=== Job: ${job.name} (${job.status}) ===\n${jobLog}`);
        } catch {
          logs.push(`=== Job: ${job.name} (${job.status}) === (logs unavailable)`);
        }
      }

      return logs.join('\n\n');
    } catch {
      return `Pipeline ${this.pipelineId} completed successfully (logs unavailable)`;
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
    OrchestratorLogger.log(`[GitLabCI] Cleanup complete`);
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
    return [];
  }

  async listWorkflow(): Promise<ProviderWorkflow[]> {
    if (!this.projectId || !this.triggerToken) return [];

    try {
      const encodedProject = encodeURIComponent(this.projectId);
      const response = await OrchestratorSystem.Run(
        `curl -sf -H "PRIVATE-TOKEN: ${this.triggerToken}" "${this.apiUrl}/api/v4/projects/${encodedProject}/pipelines?per_page=10"`,
        true,
      );

      return JSON.parse(response).map((pipeline: any) => {
        const workflow = new ProviderWorkflow();
        workflow.Name = `Pipeline #${pipeline.id} (${pipeline.status})`;

        return workflow;
      });
    } catch {
      return [];
    }
  }

  async watchWorkflow(): Promise<string> {
    return '';
  }
}
export default GitLabCIProvider;
