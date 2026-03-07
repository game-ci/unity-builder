import AnsibleProvider from '.';
import BuildParameters from '../../../build-parameters';
import { OrchestratorSystem } from '../../services/core/orchestrator-system';
import OrchestratorLogger from '../../services/core/orchestrator-logger';
import * as core from '@actions/core';

jest.mock('../../services/core/orchestrator-system');
jest.mock('../../services/core/orchestrator-logger');
jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  setOutput: jest.fn(),
  getInput: jest.fn(() => ''),
}));

const mockRun = OrchestratorSystem.Run as jest.MockedFunction<typeof OrchestratorSystem.Run>;
const mockLog = OrchestratorLogger.log as jest.MockedFunction<typeof OrchestratorLogger.log>;
const mockLogWarning = OrchestratorLogger.logWarning as jest.MockedFunction<typeof OrchestratorLogger.logWarning>;

function createBuildParameters(overrides: Partial<BuildParameters> = {}): BuildParameters {
  return {
    ansibleInventory: '/etc/ansible/hosts',
    ansiblePlaybook: '/playbooks/unity-build.yml',
    ansibleExtraVars: '',
    ansibleVaultPassword: '',
    ...overrides,
  } as BuildParameters;
}

describe('AnsibleProvider', () => {
  let provider: AnsibleProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new AnsibleProvider(createBuildParameters());
  });

  describe('constructor', () => {
    it('initializes with all provided parameters', () => {
      const params = createBuildParameters({
        ansibleInventory: '/custom/inventory',
        ansiblePlaybook: '/custom/playbook.yml',
        ansibleExtraVars: '{"key":"value"}',
        ansibleVaultPassword: '/vault/pass',
      });
      const p = new AnsibleProvider(params);
      expect(p).toBeDefined();
    });

    it('handles missing optional parameters gracefully', () => {
      const params = createBuildParameters({
        ansiblePlaybook: undefined,
        ansibleExtraVars: undefined,
        ansibleVaultPassword: undefined,
      });
      const p = new AnsibleProvider(params);
      expect(p).toBeDefined();
    });
  });

  describe('setupWorkflow', () => {
    it('verifies ansible binary, ansible-playbook binary, and inventory exist', async () => {
      mockRun.mockResolvedValueOnce('ansible [core 2.14.0]'); // ansible --version
      mockRun.mockResolvedValueOnce('/usr/bin/ansible-playbook'); // ansible-playbook check
      mockRun.mockResolvedValueOnce(''); // test -e inventory

      await provider.setupWorkflow('guid-123', createBuildParameters(), 'main', []);

      expect(mockRun).toHaveBeenCalledTimes(3);
      expect(mockRun.mock.calls[0][0]).toContain('ansible --version');
      expect(mockRun.mock.calls[1][0]).toContain('ansible-playbook');
      expect(mockRun.mock.calls[2][0]).toContain('test -e "/etc/ansible/hosts"');
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('ansible'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('ansible-playbook binary verified'));
    });

    it('throws when inventory is not configured', async () => {
      const params = createBuildParameters({ ansibleInventory: '' });
      provider = new AnsibleProvider(params);

      await expect(provider.setupWorkflow('guid-123', params, 'main', [])).rejects.toThrow(
        'ansibleInventory is required',
      );
    });

    it('throws when ansible binary is not found on PATH', async () => {
      mockRun.mockRejectedValueOnce(new Error('command not found: ansible'));

      await expect(provider.setupWorkflow('guid-123', createBuildParameters(), 'main', [])).rejects.toThrow(
        'Ansible not found on PATH',
      );
    });

    it('throws when ansible-playbook binary is not found', async () => {
      mockRun.mockResolvedValueOnce('ansible [core 2.14.0]'); // ansible version OK
      mockRun.mockRejectedValueOnce(new Error('command not found')); // ansible-playbook missing

      await expect(provider.setupWorkflow('guid-123', createBuildParameters(), 'main', [])).rejects.toThrow(
        'ansible-playbook not found on PATH',
      );

      expect(core.error).toHaveBeenCalledWith('ansible-playbook not found. Install Ansible or ensure it is in PATH.');
    });

    it('throws when inventory file does not exist', async () => {
      mockRun.mockResolvedValueOnce('ansible [core 2.14.0]'); // ansible version OK
      mockRun.mockResolvedValueOnce('/usr/bin/ansible-playbook'); // ansible-playbook OK
      mockRun.mockRejectedValueOnce(new Error('test -e failed')); // inventory missing

      await expect(provider.setupWorkflow('guid-123', createBuildParameters(), 'main', [])).rejects.toThrow(
        'Inventory not found: /etc/ansible/hosts',
      );
    });
  });

  describe('runTaskInWorkflow', () => {
    it('constructs ansible-playbook command with correct variables and returns output', async () => {
      mockRun.mockResolvedValueOnce('PLAY [build] *****\nok: [server1]\nPLAY RECAP');

      const result = await provider.runTaskInWorkflow(
        'guid-run1',
        'unityci/editor:2021.3',
        'echo build',
        '/mount',
        '/workspace',
        [],
        [],
      );

      expect(result).toContain('PLAY [build]');

      const command = mockRun.mock.calls[0][0];
      expect(command).toContain('ansible-playbook');
      expect(command).toContain('-i "/etc/ansible/hosts"');
      expect(command).toContain('"/playbooks/unity-build.yml"');
      expect(command).toContain('--no-color');
      expect(command).toContain('build_guid');
      expect(command).toContain('guid-run1');
      expect(command).toContain('build_image');
      expect(command).toContain('unityci/editor:2021.3');
      expect(command).toContain('build_commands');
      expect(command).toContain('mount_dir');
      expect(command).toContain('working_dir');
    });

    it('throws when playbook is not configured', async () => {
      const params = createBuildParameters({ ansiblePlaybook: '' });
      provider = new AnsibleProvider(params);

      await expect(provider.runTaskInWorkflow('guid-nopb', 'img', 'cmd', '/m', '/w', [], [])).rejects.toThrow(
        'ansiblePlaybook is required',
      );
    });

    it('passes environment variables as extra-vars in snake_case', async () => {
      mockRun.mockResolvedValueOnce('ok');

      const env = [
        { name: 'UNITY_LICENSE', value: 'lic-data' },
        { name: 'BUILD_TARGET', value: 'Linux64' },
      ];

      await provider.runTaskInWorkflow('guid-env', 'img', 'cmd', '/m', '/w', env as any, []);

      const command = mockRun.mock.calls[0][0];
      // Environment variable names are lowercased as Ansible variables
      expect(command).toContain('unity_license');
      expect(command).toContain('lic-data');
      expect(command).toContain('build_target');
      expect(command).toContain('Linux64');
    });

    it('merges user-provided extra vars from JSON string', async () => {
      const params = createBuildParameters({
        ansibleExtraVars: JSON.stringify({ custom_var: 'custom_value', another: '42' }),
      });
      provider = new AnsibleProvider(params);
      mockRun.mockResolvedValueOnce('ok');

      await provider.runTaskInWorkflow('guid-extra', 'img', 'cmd', '/m', '/w', [], []);

      const command = mockRun.mock.calls[0][0];
      expect(command).toContain('custom_var');
      expect(command).toContain('custom_value');
      expect(command).toContain('another');
    });

    it('logs warning when extra vars JSON is invalid but continues', async () => {
      const params = createBuildParameters({ ansibleExtraVars: 'not-valid-json{{{' });
      provider = new AnsibleProvider(params);
      mockRun.mockResolvedValueOnce('ok');

      await provider.runTaskInWorkflow('guid-badjson', 'img', 'cmd', '/m', '/w', [], []);

      expect(mockLogWarning).toHaveBeenCalledWith(expect.stringContaining('Failed to parse ansibleExtraVars'));
    });

    it('includes vault password file flag when configured', async () => {
      const params = createBuildParameters({ ansibleVaultPassword: '/secure/vault-pass.txt' });
      provider = new AnsibleProvider(params);
      mockRun.mockResolvedValueOnce('ok');

      await provider.runTaskInWorkflow('guid-vault', 'img', 'cmd', '/m', '/w', [], []);

      const command = mockRun.mock.calls[0][0];
      expect(command).toContain('--vault-password-file "/secure/vault-pass.txt"');
    });

    it('does not include vault password flag when not configured', async () => {
      mockRun.mockResolvedValueOnce('ok');

      await provider.runTaskInWorkflow('guid-novault', 'img', 'cmd', '/m', '/w', [], []);

      const command = mockRun.mock.calls[0][0];
      expect(command).not.toContain('--vault-password-file');
    });

    it('prefixes secrets as environment variables in the command', async () => {
      mockRun.mockResolvedValueOnce('ok');

      const secrets = [
        { ParameterKey: 'key1', EnvironmentVariable: 'SECRET_TOKEN', ParameterValue: 'tok-abc' },
        { ParameterKey: 'key2', EnvironmentVariable: 'DEPLOY_KEY', ParameterValue: 'dk-xyz' },
      ];

      await provider.runTaskInWorkflow('guid-secrets', 'img', 'cmd', '/m', '/w', [], secrets as any);

      const command = mockRun.mock.calls[0][0];
      expect(command).toMatch(/^SECRET_TOKEN='tok-abc'/);
      expect(command).toContain("DEPLOY_KEY='dk-xyz'");
      expect(command).toContain('ansible-playbook');
    });

    it('throws and logs warning when playbook execution fails', async () => {
      const execError = new Error('UNREACHABLE! Host unreachable');
      mockRun.mockRejectedValueOnce(execError);

      await expect(provider.runTaskInWorkflow('guid-hostfail', 'img', 'cmd', '/m', '/w', [], [])).rejects.toThrow(
        'UNREACHABLE',
      );

      expect(mockLogWarning).toHaveBeenCalledWith(expect.stringContaining('Playbook failed'));
    });
  });

  describe('cleanupWorkflow', () => {
    it('completes without error and logs cleanup message', async () => {
      await provider.cleanupWorkflow(createBuildParameters(), 'main', []);
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Cleanup complete'));
    });
  });

  describe('garbageCollect', () => {
    it('returns empty string (no-op)', async () => {
      const result = await provider.garbageCollect('', false, 0, false, false);
      expect(result).toBe('');
    });
  });

  describe('listResources', () => {
    it('returns inventory path as a resource when configured', async () => {
      const resources = await provider.listResources();

      expect(resources).toHaveLength(1);
      expect(resources[0].Name).toBe('/etc/ansible/hosts');
    });

    it('returns empty array when inventory is not configured', async () => {
      const params = createBuildParameters({ ansibleInventory: '' });
      provider = new AnsibleProvider(params);

      const resources = await provider.listResources();
      expect(resources).toEqual([]);
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
