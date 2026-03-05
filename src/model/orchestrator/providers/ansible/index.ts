import BuildParameters from '../../../build-parameters';
import { OrchestratorSystem } from '../../services/core/orchestrator-system';
import OrchestratorEnvironmentVariable from '../../options/orchestrator-environment-variable';
import OrchestratorLogger from '../../services/core/orchestrator-logger';
import { ProviderInterface } from '../provider-interface';
import OrchestratorSecret from '../../options/orchestrator-secret';
import { ProviderResource } from '../provider-resource';
import { ProviderWorkflow } from '../provider-workflow';

/**
 * Ansible provider — executes Unity builds via Ansible playbooks
 * against managed inventory.
 *
 * Use case: Teams with existing Ansible infrastructure for server
 * management who want to leverage their inventory for build distribution.
 */
class AnsibleProvider implements ProviderInterface {
  private buildParameters: BuildParameters;
  private inventory: string;
  private playbook: string;
  private extraVariables: string;
  private vaultPassword: string;

  constructor(buildParameters: BuildParameters) {
    this.buildParameters = buildParameters;
    this.inventory = buildParameters.ansibleInventory || '';
    this.playbook = buildParameters.ansiblePlaybook || '';
    this.extraVariables = buildParameters.ansibleExtraVars || '';
    this.vaultPassword = buildParameters.ansibleVaultPassword || '';
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
    OrchestratorLogger.log(`[Ansible] Setting up playbook execution`);

    if (!this.inventory) {
      throw new Error('ansibleInventory is required for the ansible provider');
    }

    // Verify ansible is available
    try {
      const version = await OrchestratorSystem.Run('ansible --version | head -1');
      OrchestratorLogger.log(`[Ansible] ${version.trim()}`);
    } catch (error: any) {
      throw new Error(`Ansible not found on PATH: ${error.message || error}`);
    }

    // Verify inventory exists
    try {
      await OrchestratorSystem.Run(`test -e "${this.inventory}"`);
    } catch {
      throw new Error(`Inventory not found: ${this.inventory}`);
    }
  }

  async runTaskInWorkflow(
    buildGuid: string,
    image: string,
    commands: string,
    mountdir: string,
    workingdir: string,
    environment: OrchestratorEnvironmentVariable[],
    secrets: OrchestratorSecret[],
  ): Promise<string> {
    OrchestratorLogger.log(`[Ansible] Running playbook against inventory ${this.inventory}`);

    if (!this.playbook) {
      throw new Error(
        'ansiblePlaybook is required — no default playbook is provided yet. ' +
          'Provide a playbook that accepts build_guid, build_image, build_commands, mount_dir, and working_dir variables.',
      );
    }

    // Build extra-vars JSON
    // These use snake_case because they are Ansible variable names passed to playbooks
    const playbookVariables: Record<string, string> = {
      // eslint-disable-next-line camelcase
      build_guid: buildGuid,
      // eslint-disable-next-line camelcase
      build_image: image,
      // eslint-disable-next-line camelcase
      build_commands: commands,
      // eslint-disable-next-line camelcase
      mount_dir: mountdir,
      // eslint-disable-next-line camelcase
      working_dir: workingdir,
    };

    for (const element of environment) {
      playbookVariables[element.name.toLowerCase()] = element.value;
    }

    // Merge user-provided extra vars
    if (this.extraVariables) {
      try {
        const userVariables = JSON.parse(this.extraVariables);
        Object.assign(playbookVariables, userVariables);
      } catch {
        OrchestratorLogger.logWarning(`[Ansible] Failed to parse ansibleExtraVars as JSON, using as-is`);
      }
    }

    const extraVariablesJson = JSON.stringify(playbookVariables).replace(/'/g, "'\\''");

    // Build ansible-playbook command
    const commandParts = [
      'ansible-playbook',
      `-i "${this.inventory}"`,
      `"${this.playbook}"`,
      `-e '${extraVariablesJson}'`,
      '--no-color',
    ];

    if (this.vaultPassword) {
      commandParts.push(`--vault-password-file "${this.vaultPassword}"`);
    }

    // Add secret variables as extra environment
    const environmentPrefix = secrets
      .map((secret) => `${secret.EnvironmentVariable}='${secret.ParameterValue}'`)
      .join(' ');

    const fullCommand = environmentPrefix ? `${environmentPrefix} ${commandParts.join(' ')}` : commandParts.join(' ');

    try {
      const output = await OrchestratorSystem.Run(fullCommand);
      OrchestratorLogger.log(`[Ansible] Playbook completed successfully`);

      return output;
    } catch (error: any) {
      OrchestratorLogger.logWarning(`[Ansible] Playbook failed: ${error.message || error}`);
      throw error;
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
    OrchestratorLogger.log(`[Ansible] Cleanup complete`);
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
    if (!this.inventory) return [];

    const resource = new ProviderResource();
    resource.Name = this.inventory;

    return [resource];
  }

  async listWorkflow(): Promise<ProviderWorkflow[]> {
    return [];
  }

  async watchWorkflow(): Promise<string> {
    return '';
  }
}
export default AnsibleProvider;
