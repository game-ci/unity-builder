import fs from 'node:fs';
import { SecretSourceService } from './secret-source-service';

jest.mock('node:fs');
jest.mock('../core/orchestrator-system', () => ({
  OrchestratorSystem: {
    Run: jest.fn().mockResolvedValue(''),
  },
}));
jest.mock('../core/orchestrator-logger', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    logWarning: jest.fn(),
    error: jest.fn(),
  },
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('SecretSourceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isPremadeSource', () => {
    it('should return true for aws-secrets-manager', () => {
      expect(SecretSourceService.isPremadeSource('aws-secrets-manager')).toBe(true);
    });

    it('should return true for aws-secret-manager (legacy alias)', () => {
      expect(SecretSourceService.isPremadeSource('aws-secret-manager')).toBe(true);
    });

    it('should return true for aws-parameter-store', () => {
      expect(SecretSourceService.isPremadeSource('aws-parameter-store')).toBe(true);
    });

    it('should return true for gcp-secret-manager', () => {
      expect(SecretSourceService.isPremadeSource('gcp-secret-manager')).toBe(true);
    });

    it('should return true for azure-key-vault', () => {
      expect(SecretSourceService.isPremadeSource('azure-key-vault')).toBe(true);
    });

    it('should return false for unknown source', () => {
      expect(SecretSourceService.isPremadeSource('hashicorp-vault')).toBe(false);
    });
  });

  describe('getAvailableSources', () => {
    it('should return all premade source names', () => {
      const sources = SecretSourceService.getAvailableSources();
      expect(sources).toContain('aws-secrets-manager');
      expect(sources).toContain('aws-parameter-store');
      expect(sources).toContain('gcp-secret-manager');
      expect(sources).toContain('azure-key-vault');
      expect(sources.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('resolveSource', () => {
    it('should resolve premade source by name', () => {
      const source = SecretSourceService.resolveSource('aws-secrets-manager');
      expect(source).toBeDefined();
      expect(source!.name).toBe('aws-secrets-manager');
      expect(source!.command).toContain('secretsmanager');
    });

    it('should resolve custom command with {0} placeholder', () => {
      const source = SecretSourceService.resolveSource('vault kv get -field=value secret/{0}');
      expect(source).toBeDefined();
      expect(source!.name).toBe('custom-command');
      expect(source!.command).toContain('{0}');
    });

    it('should resolve command with spaces as custom command', () => {
      const source = SecretSourceService.resolveSource('my-tool get-secret');
      expect(source).toBeDefined();
      expect(source!.name).toBe('custom-command');
    });

    it('should return undefined for unknown single-word source', () => {
      const source = SecretSourceService.resolveSource('unknown');
      expect(source).toBeUndefined();
    });
  });

  describe('fetchSecret', () => {
    it('should run the command with {0} replaced by key', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      OrchestratorSystem.Run.mockResolvedValue('my-secret-value');

      const source = SecretSourceService.resolveSource('aws-secrets-manager')!;
      const result = await SecretSourceService.fetchSecret(source, 'MY_SECRET');

      expect(result).toBe('my-secret-value');
      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(
        expect.stringContaining('MY_SECRET'),
        false,
        true,
      );
    });

    it('should parse JSON output when parseOutput is json-field', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      OrchestratorSystem.Run.mockResolvedValue(JSON.stringify({ value: 'extracted-secret' }));

      const source = {
        name: 'test-source',
        command: 'fetch {0}',
        parseOutput: 'json-field' as const,
        jsonField: 'value',
      };
      const result = await SecretSourceService.fetchSecret(source, 'KEY');

      expect(result).toBe('extracted-secret');
    });

    it('should fall back to raw output on invalid JSON with json-field mode', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      OrchestratorSystem.Run.mockResolvedValue('not-json');

      const source = {
        name: 'test-source',
        command: 'fetch {0}',
        parseOutput: 'json-field' as const,
        jsonField: 'value',
      };
      const result = await SecretSourceService.fetchSecret(source, 'KEY');

      expect(result).toBe('not-json');
    });

    it('should return empty string on command failure', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      OrchestratorSystem.Run.mockRejectedValue(new Error('command not found'));

      const source = SecretSourceService.resolveSource('aws-secrets-manager')!;
      const result = await SecretSourceService.fetchSecret(source, 'KEY');

      expect(result).toBe('');
    });
  });

  describe('fetchFromEnv', () => {
    it('should return env var value when set', () => {
      process.env.TEST_SECRET_KEY = 'env-value';
      const result = SecretSourceService.fetchFromEnv('TEST_SECRET_KEY');
      expect(result).toBe('env-value');
      delete process.env.TEST_SECRET_KEY;
    });

    it('should return empty string when env var is not set', () => {
      const result = SecretSourceService.fetchFromEnv('NONEXISTENT_KEY_12345');
      expect(result).toBe('');
    });
  });

  describe('fetchAll', () => {
    it('should fetch all keys from env source', async () => {
      process.env.KEY_A = 'val-a';
      process.env.KEY_B = 'val-b';

      const results = await SecretSourceService.fetchAll('env', ['KEY_A', 'KEY_B']);

      expect(results.KEY_A).toBe('val-a');
      expect(results.KEY_B).toBe('val-b');

      delete process.env.KEY_A;
      delete process.env.KEY_B;
    });

    it('should fetch all keys from premade source', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      OrchestratorSystem.Run
        .mockResolvedValueOnce('secret-1')
        .mockResolvedValueOnce('secret-2');

      const results = await SecretSourceService.fetchAll('aws-parameter-store', ['param1', 'param2']);

      expect(results.param1).toBe('secret-1');
      expect(results.param2).toBe('secret-2');
      expect(OrchestratorSystem.Run).toHaveBeenCalledTimes(2);
    });

    it('should return empty results for unknown source', async () => {
      const results = await SecretSourceService.fetchAll('unknown', ['key1']);
      expect(results).toEqual({});
    });
  });

  describe('loadFromYaml', () => {
    it('should return empty array when file does not exist', () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);
      const result = SecretSourceService.loadFromYaml('/nonexistent.yml');
      expect(result).toEqual([]);
    });

    it('should parse valid YAML source definitions', () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(`
sources:
  - name: my-vault
    command: 'vault kv get -field=value secret/{0}'
  - name: my-api
    command: 'curl -s https://api.example.com/{0}'
    parseOutput: json-field
    jsonField: secret_value
`);

      const result = SecretSourceService.loadFromYaml('/sources.yml');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('my-vault');
      expect(result[0].command).toBe('vault kv get -field=value secret/{0}');
      expect(result[1].name).toBe('my-api');
      expect(result[1].parseOutput).toBe('json-field');
      expect(result[1].jsonField).toBe('secret_value');
    });

    it('should handle YAML with single source', () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(`
sources:
  - name: simple
    command: echo {0}
`);

      const result = SecretSourceService.loadFromYaml('/simple.yml');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('simple');
    });

    it('should return empty array on parse error', () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = SecretSourceService.loadFromYaml('/error.yml');
      expect(result).toEqual([]);
    });
  });

  describe('premade source commands', () => {
    it('aws-secrets-manager uses --query SecretString', () => {
      const source = SecretSourceService.resolveSource('aws-secrets-manager')!;
      expect(source.command).toContain('--query SecretString');
      expect(source.command).toContain('--output text');
    });

    it('aws-parameter-store uses --with-decryption', () => {
      const source = SecretSourceService.resolveSource('aws-parameter-store')!;
      expect(source.command).toContain('--with-decryption');
      expect(source.command).toContain('--query Parameter.Value');
    });

    it('gcp-secret-manager uses latest version', () => {
      const source = SecretSourceService.resolveSource('gcp-secret-manager')!;
      expect(source.command).toContain('latest');
    });

    it('azure-key-vault uses AZURE_VAULT_NAME env var', () => {
      const source = SecretSourceService.resolveSource('azure-key-vault')!;
      expect(source.command).toContain('$AZURE_VAULT_NAME');
    });
  });
});
