import { spawn, ChildProcess } from 'child_process';
import * as core from '@actions/core';
import { ProviderInterface } from '../provider-interface';
import BuildParameters from '../../../build-parameters';
import OrchestratorEnvironmentVariable from '../../options/orchestrator-environment-variable';
import OrchestratorSecret from '../../options/orchestrator-secret';
import { ProviderResource } from '../provider-resource';
import { ProviderWorkflow } from '../provider-workflow';
import OrchestratorLogger from '../../services/core/orchestrator-logger';
import { CliProviderRequest, CliProviderResponse, CliProviderSubcommand } from './cli-provider-protocol';

const DEFAULT_TIMEOUT_MS = 300_000; // 300 seconds
const RUN_TASK_TIMEOUT_MS = 7_200_000; // 2 hours
const WATCH_WORKFLOW_TIMEOUT_MS = 3_600_000; // 1 hour
const SIGKILL_GRACE_MS = 10_000; // 10 seconds grace period before SIGKILL

/**
 * Gracefully kill a child process: SIGTERM first, then SIGKILL after a grace period.
 */
function gracefulKill(child: ChildProcess, graceMs: number = SIGKILL_GRACE_MS): void {
  child.kill('SIGTERM');

  const forceKillTimer = setTimeout(() => {
    try {
      child.kill('SIGKILL');
    } catch {
      // Process may already be dead
    }
  }, graceMs);

  // Clear the force-kill timer if the process exits on its own
  child.on('close', () => {
    clearTimeout(forceKillTimer);
  });
}

class CliProvider implements ProviderInterface {
  private readonly executablePath: string;
  private readonly buildParameters: BuildParameters;

  constructor(executablePath: string, buildParameters: BuildParameters) {
    if (!executablePath || executablePath.trim() === '') {
      throw new Error('CliProvider: executablePath must be a non-empty string');
    }
    this.executablePath = executablePath;
    this.buildParameters = buildParameters;
  }

  async setupWorkflow(
    buildGuid: string,
    buildParameters: BuildParameters,
    branchName: string,
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ): Promise<any> {
    const response = await this.execute('setup-workflow', {
      buildGuid,
      buildParameters,
      branchName,
      defaultSecretsArray,
    });

    return response.result;
  }

  async cleanupWorkflow(
    buildParameters: BuildParameters,
    branchName: string,
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ): Promise<any> {
    const response = await this.execute('cleanup-workflow', {
      buildParameters,
      branchName,
      defaultSecretsArray,
    });

    return response.result;
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
    const request: CliProviderRequest = {
      command: 'run-task',
      params: {
        buildGuid,
        image,
        commands,
        mountdir,
        workingdir,
        environment,
        secrets,
      },
    };

    const timeoutMs = RUN_TASK_TIMEOUT_MS;

    return new Promise<string>((resolve, reject) => {
      const child = spawn(this.executablePath, ['run-task'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      });

      let lastJsonResponse: CliProviderResponse | undefined;
      const outputLines: string[] = [];
      let stderrOutput = '';
      let timedOut = false;

      // Set up timeout to prevent indefinite hangs
      const timer = setTimeout(() => {
        timedOut = true;
        const minutes = Math.round(timeoutMs / 60_000);
        const message = `CLI provider timed out after ${minutes} minutes. The external provider may be unresponsive.`;
        core.error(message);
        gracefulKill(child);
        reject(new Error(`CliProvider run-task timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.stdin.write(JSON.stringify(request));
      child.stdin.end();

      child.stdout.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          // Try to parse as JSON response
          try {
            const parsed = JSON.parse(trimmed);
            if (typeof parsed === 'object' && parsed !== null && 'success' in parsed) {
              lastJsonResponse = parsed as CliProviderResponse;
              continue;
            }
          } catch {
            // Not JSON — treat as build output
          }

          // Forward non-JSON lines as real-time build output
          OrchestratorLogger.log(trimmed);
          outputLines.push(trimmed);
        }
      });

      child.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        stderrOutput += text;
        // Forward stderr to logger
        for (const line of text.split('\n')) {
          const trimmed = line.trim();
          if (trimmed) {
            OrchestratorLogger.log(`[cli-provider stderr] ${trimmed}`);
          }
        }
      });

      child.on('error', (error: Error) => {
        clearTimeout(timer);
        if (!timedOut) {
          reject(new Error(`CliProvider: failed to spawn executable '${this.executablePath}': ${error.message}`));
        }
      });

      child.on('close', (code: number | null) => {
        clearTimeout(timer);
        if (timedOut) return;

        if (lastJsonResponse) {
          if (lastJsonResponse.success) {
            resolve(lastJsonResponse.output || outputLines.join('\n'));
          } else {
            reject(
              new Error(`CliProvider run-task failed: ${lastJsonResponse.error || 'Unknown error from CLI provider'}`),
            );
          }
        } else if (code === 0) {
          resolve(outputLines.join('\n'));
        } else {
          reject(
            new Error(`CliProvider run-task exited with code ${code}${stderrOutput ? ': ' + stderrOutput.trim() : ''}`),
          );
        }
      });
    });
  }

  async garbageCollect(
    filter: string,
    previewOnly: boolean,
    olderThan: Number,
    fullCache: boolean,
    baseDependencies: boolean,
  ): Promise<string> {
    const response = await this.execute('garbage-collect', {
      filter,
      previewOnly,
      olderThan,
      fullCache,
      baseDependencies,
    });

    return response.output || '';
  }

  async listResources(): Promise<ProviderResource[]> {
    const response = await this.execute('list-resources', {});

    return (response.result as ProviderResource[]) || [];
  }

  async listWorkflow(): Promise<ProviderWorkflow[]> {
    const response = await this.execute('list-workflow', {});

    return (response.result as ProviderWorkflow[]) || [];
  }

  async watchWorkflow(): Promise<string> {
    const request: CliProviderRequest = {
      command: 'watch-workflow',
      params: {},
    };

    const timeoutMs = WATCH_WORKFLOW_TIMEOUT_MS;

    return new Promise<string>((resolve, reject) => {
      const child = spawn(this.executablePath, ['watch-workflow'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      });

      let lastJsonResponse: CliProviderResponse | undefined;
      const outputLines: string[] = [];
      let timedOut = false;

      // Set up timeout to prevent indefinite hangs
      const timer = setTimeout(() => {
        timedOut = true;
        const minutes = Math.round(timeoutMs / 60_000);
        const message = `CLI provider timed out after ${minutes} minutes. The external provider may be unresponsive.`;
        core.error(message);
        gracefulKill(child);
        reject(new Error(`CliProvider watch-workflow timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.stdin.write(JSON.stringify(request));
      child.stdin.end();

      child.stdout.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const parsed = JSON.parse(trimmed);
            if (typeof parsed === 'object' && parsed !== null && 'success' in parsed) {
              lastJsonResponse = parsed as CliProviderResponse;
              continue;
            }
          } catch {
            // Not JSON
          }

          OrchestratorLogger.log(trimmed);
          outputLines.push(trimmed);
        }
      });

      child.stderr.on('data', (data: Buffer) => {
        for (const line of data.toString().split('\n')) {
          const trimmed = line.trim();
          if (trimmed) {
            OrchestratorLogger.log(`[cli-provider stderr] ${trimmed}`);
          }
        }
      });

      child.on('error', (error: Error) => {
        clearTimeout(timer);
        if (!timedOut) {
          reject(new Error(`CliProvider: failed to spawn executable '${this.executablePath}': ${error.message}`));
        }
      });

      child.on('close', (code: number | null) => {
        clearTimeout(timer);
        if (timedOut) return;

        if (lastJsonResponse) {
          if (lastJsonResponse.success) {
            resolve(lastJsonResponse.output || outputLines.join('\n'));
          } else {
            reject(new Error(`CliProvider watch-workflow failed: ${lastJsonResponse.error || 'Unknown error'}`));
          }
        } else if (code === 0) {
          resolve(outputLines.join('\n'));
        } else {
          reject(new Error(`CliProvider watch-workflow exited with code ${code}`));
        }
      });
    });
  }

  /**
   * Execute a CLI provider subcommand with a default timeout.
   * Timeout applies a graceful SIGTERM followed by SIGKILL after a grace period.
   */
  private execute(
    command: CliProviderSubcommand,
    params: Record<string, any>,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ): Promise<CliProviderResponse> {
    const request: CliProviderRequest = { command, params };

    return new Promise<CliProviderResponse>((resolve, reject) => {
      const child = spawn(this.executablePath, [command], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      });

      let stdoutData = '';
      let stderrData = '';
      let timedOut = false;

      // Set up timeout with graceful kill
      const timer = setTimeout(() => {
        timedOut = true;
        gracefulKill(child);
        reject(new Error(`CliProvider: command '${command}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.stdin.write(JSON.stringify(request));
      child.stdin.end();

      child.stdout.on('data', (data: Buffer) => {
        stdoutData += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        stderrData += text;
        // Forward stderr to logger
        for (const line of text.split('\n')) {
          const trimmed = line.trim();
          if (trimmed) {
            OrchestratorLogger.log(`[cli-provider stderr] ${trimmed}`);
          }
        }
      });

      child.on('error', (error: Error) => {
        clearTimeout(timer);
        if (!timedOut) {
          reject(new Error(`CliProvider: failed to spawn executable '${this.executablePath}': ${error.message}`));
        }
      });

      child.on('close', (code: number | null) => {
        clearTimeout(timer);
        if (timedOut) return;

        // Find the last JSON line in stdout
        const lines = stdoutData.split('\n').filter((l) => l.trim());
        let response: CliProviderResponse | undefined;

        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const parsed = JSON.parse(lines[i].trim());
            if (typeof parsed === 'object' && parsed !== null && 'success' in parsed) {
              response = parsed as CliProviderResponse;
              break;
            }
          } catch {
            // Not valid JSON, skip
          }
        }

        if (response) {
          if (response.success) {
            resolve(response);
          } else {
            reject(new Error(`CliProvider ${command} failed: ${response.error || 'Unknown error from CLI provider'}`));
          }
        } else if (code === 0) {
          // No JSON response but exit code 0 — treat as success with raw output
          resolve({ success: true, output: stdoutData.trim() });
        } else {
          reject(
            new Error(
              `CliProvider ${command} exited with code ${code}` +
                (stderrData ? `: ${stderrData.trim()}` : '') +
                (!stderrData && stdoutData ? `: ${stdoutData.trim()}` : ''),
            ),
          );
        }
      });
    });
  }
}

export default CliProvider;
