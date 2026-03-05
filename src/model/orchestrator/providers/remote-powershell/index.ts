import BuildParameters from '../../../build-parameters';
import { OrchestratorSystem } from '../../services/core/orchestrator-system';
import OrchestratorEnvironmentVariable from '../../options/orchestrator-environment-variable';
import OrchestratorLogger from '../../services/core/orchestrator-logger';
import { ProviderInterface } from '../provider-interface';
import OrchestratorSecret from '../../options/orchestrator-secret';
import { ProviderResource } from '../provider-resource';
import { ProviderWorkflow } from '../provider-workflow';

/**
 * Remote PowerShell provider — executes Unity builds on remote machines
 * via PowerShell Remoting (WinRM or SSH).
 *
 * Use case: Teams with dedicated build machines not part of a CI system.
 */
class RemotePowershellProvider implements ProviderInterface {
  private buildParameters: BuildParameters;
  private host: string;
  private transport: string;
  private credential: string;
  private sessionId: string = '';

  constructor(buildParameters: BuildParameters) {
    this.buildParameters = buildParameters;
    this.host = buildParameters.remotePowershellHost || '';
    this.transport = buildParameters.remotePowershellTransport || 'wsman';
    this.credential = buildParameters.remotePowershellCredential || '';
  }

  async setupWorkflow(
    buildGuid: string,
    // eslint-disable-next-line no-unused-vars
    buildParameters: BuildParameters,
    // eslint-disable-next-line no-unused-vars
    branchName: string,
    // eslint-disable-next-line no-unused-vars
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ): Promise<void> {
    OrchestratorLogger.log(`[RemotePowershell] Setting up remote session to ${this.host} via ${this.transport}`);

    if (!this.host) {
      throw new Error('remotePowershellHost is required for the remote-powershell provider');
    }

    // Test connectivity
    const testCommand = this.buildPwshCommand(`Test-WSMan -ComputerName "${this.host}" -ErrorAction Stop`);
    try {
      await OrchestratorSystem.Run(testCommand);
      OrchestratorLogger.log(`[RemotePowershell] Connection test passed`);
    } catch (error: any) {
      throw new Error(`Failed to connect to remote host ${this.host}: ${error.message || error}`);
    }

    this.sessionId = buildGuid;
    OrchestratorLogger.log(`[RemotePowershell] Session ${this.sessionId} ready`);
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
    OrchestratorLogger.log(`[RemotePowershell] Executing task on ${this.host}`);

    // Build environment variable block for remote session
    const environmentBlock = environment.map((element) => `$env:${element.name} = '${element.value}'`).join('; ');

    const secretBlock = secrets
      .map((secret) => `$env:${secret.EnvironmentVariable} = '${secret.ParameterValue}'`)
      .join('; ');

    // Wrap commands for remote execution
    const remoteScript = [environmentBlock, secretBlock, `Set-Location "${workingdir}"`, commands]
      .filter(Boolean)
      .join('; ');

    const invokeCommand = this.buildInvokeCommand(remoteScript);

    try {
      const output = await OrchestratorSystem.Run(invokeCommand);
      OrchestratorLogger.log(`[RemotePowershell] Task completed successfully`);

      return output;
    } catch (error: any) {
      OrchestratorLogger.logWarning(`[RemotePowershell] Task failed: ${error.message || error}`);
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
    OrchestratorLogger.log(`[RemotePowershell] Cleaning up session ${this.sessionId}`);

    // Remote sessions are stateless per invocation — no cleanup needed
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
    OrchestratorLogger.log(`[RemotePowershell] Garbage collection not supported for remote PowerShell provider`);

    return '';
  }

  async listResources(): Promise<ProviderResource[]> {
    const resource = new ProviderResource();
    resource.Name = this.host;

    return [resource];
  }

  async listWorkflow(): Promise<ProviderWorkflow[]> {
    return [];
  }

  async watchWorkflow(): Promise<string> {
    return '';
  }

  private buildPwshCommand(script: string): string {
    return `pwsh -NoProfile -NonInteractive -Command "${script.replace(/"/g, '\\"')}"`;
  }

  private buildInvokeCommand(remoteScript: string): string {
    const escapedScript = remoteScript.replace(/"/g, '\\"').replace(/'/g, "''");

    if (this.transport === 'ssh') {
      return `pwsh -NoProfile -NonInteractive -Command "Invoke-Command -HostName '${this.host}' -ScriptBlock { ${escapedScript} }"`;
    }

    // WinRM (default)
    const credentialPart = this.credential
      ? `-Credential (New-Object PSCredential('${this.credential.split(':')[0]}', (ConvertTo-SecureString '${
          this.credential.split(':')[1]
        }' -AsPlainText -Force)))`
      : '';

    return `pwsh -NoProfile -NonInteractive -Command "Invoke-Command -ComputerName '${this.host}' ${credentialPart} -ScriptBlock { ${escapedScript} }"`;
  }
}
export default RemotePowershellProvider;
