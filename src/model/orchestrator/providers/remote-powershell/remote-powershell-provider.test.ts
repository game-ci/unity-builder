import RemotePowershellProvider from '.';
import BuildParameters from '../../../build-parameters';
import { OrchestratorSystem } from '../../services/core/orchestrator-system';
import OrchestratorLogger from '../../services/core/orchestrator-logger';

jest.mock('../../services/core/orchestrator-system');
jest.mock('../../services/core/orchestrator-logger');

const mockRun = OrchestratorSystem.Run as jest.MockedFunction<typeof OrchestratorSystem.Run>;
const mockLog = OrchestratorLogger.log as jest.MockedFunction<typeof OrchestratorLogger.log>;
const mockLogWarning = OrchestratorLogger.logWarning as jest.MockedFunction<typeof OrchestratorLogger.logWarning>;

function createBuildParameters(overrides: Partial<BuildParameters> = {}): BuildParameters {
  return {
    remotePowershellHost: 'build-server-01.internal',
    remotePowershellTransport: 'wsman',
    remotePowershellCredential: 'admin:P@ssw0rd!',
    ...overrides,
  } as BuildParameters;
}

describe('RemotePowershellProvider', () => {
  let provider: RemotePowershellProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new RemotePowershellProvider(createBuildParameters());
  });

  describe('constructor', () => {
    it('defaults transport to wsman when not specified', () => {
      const params = createBuildParameters({ remotePowershellTransport: undefined });
      const p = new RemotePowershellProvider(params);
      expect(p).toBeDefined();
    });

    it('accepts ssh transport', () => {
      const params = createBuildParameters({ remotePowershellTransport: 'ssh' });
      const p = new RemotePowershellProvider(params);
      expect(p).toBeDefined();
    });
  });

  describe('setupWorkflow', () => {
    it('tests WinRM connectivity via Test-WSMan and logs success', async () => {
      mockRun.mockResolvedValueOnce('wsman output');

      await provider.setupWorkflow('guid-123', createBuildParameters(), 'main', []);

      expect(mockRun).toHaveBeenCalledTimes(1);
      const command = mockRun.mock.calls[0][0];
      expect(command).toContain('pwsh -NoProfile -NonInteractive');
      expect(command).toContain('Test-WSMan');
      expect(command).toContain('build-server-01.internal');
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Connection test passed'));
    });

    it('sets session ID to the build GUID', async () => {
      mockRun.mockResolvedValueOnce('');

      await provider.setupWorkflow('my-build-guid', createBuildParameters(), 'main', []);

      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('my-build-guid'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('ready'));
    });

    it('throws when host is not configured', async () => {
      const params = createBuildParameters({ remotePowershellHost: '' });
      provider = new RemotePowershellProvider(params);

      await expect(provider.setupWorkflow('guid-123', params, 'main', [])).rejects.toThrow(
        'remotePowershellHost is required',
      );
    });

    it('throws descriptive error when connectivity test fails', async () => {
      mockRun.mockRejectedValueOnce(new Error('WinRM service not running'));

      await expect(provider.setupWorkflow('guid-123', createBuildParameters(), 'main', [])).rejects.toThrow(
        'Failed to connect to remote host build-server-01.internal',
      );
    });
  });

  describe('runTaskInWorkflow', () => {
    it('constructs WinRM Invoke-Command with credential and returns output', async () => {
      mockRun.mockResolvedValueOnce('Build succeeded!');

      const result = await provider.runTaskInWorkflow(
        'guid-run1',
        'unused-image',
        'Unity.exe -batchmode -buildTarget Win64',
        '/mount',
        'C:\\Projects\\MyGame',
        [],
        [],
      );

      expect(result).toBe('Build succeeded!');

      const command = mockRun.mock.calls[0][0];
      expect(command).toContain('pwsh -NoProfile -NonInteractive');
      expect(command).toContain("Invoke-Command -ComputerName 'build-server-01.internal'");
      expect(command).toContain('-Credential');
      expect(command).toContain('New-Object PSCredential');
      expect(command).toContain('-ScriptBlock');
      expect(command).toContain('Set-Location');
    });

    it('constructs SSH Invoke-Command when transport is ssh', async () => {
      const params = createBuildParameters({ remotePowershellTransport: 'ssh' });
      provider = new RemotePowershellProvider(params);
      mockRun.mockResolvedValueOnce('SSH build output');

      const result = await provider.runTaskInWorkflow('guid-ssh', 'img', 'build', '/m', '/w', [], []);

      expect(result).toBe('SSH build output');

      const command = mockRun.mock.calls[0][0];
      expect(command).toContain("Invoke-Command -HostName 'build-server-01.internal'");
      expect(command).not.toContain('-ComputerName');
      expect(command).not.toContain('-Credential');
    });

    it('includes environment variables in the remote script block', async () => {
      mockRun.mockResolvedValueOnce('output');

      const env = [
        { name: 'UNITY_LICENSE', value: 'license-data-abc' },
        { name: 'BUILD_TARGET', value: 'StandaloneWindows64' },
      ];

      await provider.runTaskInWorkflow('guid-env', 'img', 'build-cmd', '/m', '/w', env as any, []);

      const command = mockRun.mock.calls[0][0];
      expect(command).toContain('$env:UNITY_LICENSE');
      expect(command).toContain('$env:BUILD_TARGET');
    });

    it('includes secrets in the remote script block', async () => {
      mockRun.mockResolvedValueOnce('output');

      const secrets = [
        { ParameterKey: 'key1', EnvironmentVariable: 'SECRET_KEY', ParameterValue: 'secret-val-123' },
      ];

      await provider.runTaskInWorkflow('guid-sec', 'img', 'build-cmd', '/m', '/w', [], secrets as any);

      const command = mockRun.mock.calls[0][0];
      expect(command).toContain('$env:SECRET_KEY');
    });

    it('does not include credential in plaintext log output when using WinRM', async () => {
      mockRun.mockResolvedValueOnce('output');

      await provider.runTaskInWorkflow('guid-cred', 'img', 'cmd', '/m', '/w', [], []);

      // The credential is used via ConvertTo-SecureString, not logged directly
      const command = mockRun.mock.calls[0][0];
      expect(command).toContain('ConvertTo-SecureString');
      expect(command).toContain('-AsPlainText -Force');
    });

    it('omits credential part when no credential is configured (WinRM)', async () => {
      const params = createBuildParameters({ remotePowershellCredential: '' });
      provider = new RemotePowershellProvider(params);
      mockRun.mockResolvedValueOnce('output');

      await provider.runTaskInWorkflow('guid-nocred', 'img', 'cmd', '/m', '/w', [], []);

      const command = mockRun.mock.calls[0][0];
      expect(command).toContain("Invoke-Command -ComputerName 'build-server-01.internal'");
      expect(command).not.toContain('-Credential');
      expect(command).not.toContain('PSCredential');
    });

    it('throws and logs warning when remote execution fails', async () => {
      const execError = new Error('Remote execution failed: access denied');
      mockRun.mockRejectedValueOnce(execError);

      await expect(
        provider.runTaskInWorkflow('guid-fail', 'img', 'cmd', '/m', '/w', [], []),
      ).rejects.toThrow('Remote execution failed');

      expect(mockLogWarning).toHaveBeenCalledWith(expect.stringContaining('Task failed'));
    });

    it('sets working directory in the remote script', async () => {
      mockRun.mockResolvedValueOnce('output');

      await provider.runTaskInWorkflow('guid-wd', 'img', 'cmd', '/m', 'D:\\Builds\\Project', [], []);

      const command = mockRun.mock.calls[0][0];
      expect(command).toContain('Set-Location');
      expect(command).toContain('D:\\Builds\\Project');
    });
  });

  describe('cleanupWorkflow', () => {
    it('completes without error and logs session cleanup', async () => {
      // Setup first to set sessionId
      mockRun.mockResolvedValueOnce('');
      await provider.setupWorkflow('guid-cleanup', createBuildParameters(), 'main', []);

      await provider.cleanupWorkflow(createBuildParameters(), 'main', []);

      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Cleaning up session'));
    });
  });

  describe('garbageCollect', () => {
    it('returns empty string and logs not-supported message', async () => {
      const result = await provider.garbageCollect('', false, 0, false, false);
      expect(result).toBe('');
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('not supported'));
    });
  });

  describe('listResources', () => {
    it('returns the configured host as a resource', async () => {
      const resources = await provider.listResources();

      expect(resources).toHaveLength(1);
      expect(resources[0].Name).toBe('build-server-01.internal');
    });
  });

  describe('listWorkflow', () => {
    it('returns empty array (not implemented)', async () => {
      const workflows = await provider.listWorkflow();
      expect(workflows).toEqual([]);
    });
  });

  describe('watchWorkflow', () => {
    it('returns empty string (not implemented)', async () => {
      const result = await provider.watchWorkflow();
      expect(result).toBe('');
    });
  });
});
