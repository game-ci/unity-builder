import fs from 'node:fs';
import * as core from '@actions/core';
import { SecretSourceService, validateSecretKey } from './secret-source-service';

jest.mock('node:fs');
jest.mock('@actions/core', () => ({
  setSecret: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
}));
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

  describe('validateSecretKey', () => {
    it('should accept alphanumeric keys', () => {
      expect(validateSecretKey('MY_SECRET_KEY')).toBe('MY_SECRET_KEY');
    });

    it('should accept keys with hyphens', () => {
      expect(validateSecretKey('my-secret-key')).toBe('my-secret-key');
    });

    it('should accept keys with dots', () => {
      expect(validateSecretKey('my.secret.key')).toBe('my.secret.key');
    });

    it('should accept keys with forward slashes', () => {
      expect(validateSecretKey('path/to/secret')).toBe('path/to/secret');
    });

    it('should accept keys with mixed valid characters', () => {
      expect(validateSecretKey('my-app/prod_db.password')).toBe('my-app/prod_db.password');
    });

    it('should reject keys with semicolons (shell injection)', () => {
      expect(() => validateSecretKey('; rm -rf /')).toThrow('Invalid secret key name');
    });

    it('should reject keys with backticks (command substitution)', () => {
      expect(() => validateSecretKey('`whoami`')).toThrow('Invalid secret key name');
    });

    it('should reject keys with dollar signs (variable expansion)', () => {
      expect(() => validateSecretKey('$HOME')).toThrow('Invalid secret key name');
    });

    it('should reject keys with pipe characters', () => {
      expect(() => validateSecretKey('key | cat /etc/passwd')).toThrow('Invalid secret key name');
    });

    it('should reject keys with ampersands', () => {
      expect(() => validateSecretKey('key && echo pwned')).toThrow('Invalid secret key name');
    });

    it('should reject keys with newlines', () => {
      expect(() => validateSecretKey('key\nmalicious')).toThrow('Invalid secret key name');
    });

    it('should reject keys with quotes', () => {
      expect(() => validateSecretKey('"key"')).toThrow('Invalid secret key name');
      expect(() => validateSecretKey("'key'")).toThrow('Invalid secret key name');
    });

    it('should reject keys with parentheses (subshell)', () => {
      expect(() => validateSecretKey('$(whoami)')).toThrow('Invalid secret key name');
    });

    it('should reject empty keys', () => {
      expect(() => validateSecretKey('')).toThrow('Invalid secret key name');
    });

    it('should reject keys with spaces', () => {
      expect(() => validateSecretKey('key with spaces')).toThrow('Invalid secret key name');
    });
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

    it('should return true for hashicorp-vault', () => {
      expect(SecretSourceService.isPremadeSource('hashicorp-vault')).toBe(true);
    });

    it('should return true for hashicorp-vault-kv1', () => {
      expect(SecretSourceService.isPremadeSource('hashicorp-vault-kv1')).toBe(true);
    });

    it('should return true for vault (short alias)', () => {
      expect(SecretSourceService.isPremadeSource('vault')).toBe(true);
    });

    it('should return false for unknown source', () => {
      expect(SecretSourceService.isPremadeSource('unknown-source')).toBe(false);
    });
  });

  describe('getAvailableSources', () => {
    it('should return all premade source names', () => {
      const sources = SecretSourceService.getAvailableSources();
      expect(sources).toContain('aws-secrets-manager');
      expect(sources).toContain('aws-parameter-store');
      expect(sources).toContain('gcp-secret-manager');
      expect(sources).toContain('azure-key-vault');
      expect(sources).toContain('hashicorp-vault');
      expect(sources).toContain('hashicorp-vault-kv1');
      expect(sources).toContain('vault');
      expect(sources.length).toBeGreaterThanOrEqual(8);
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
      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(expect.stringContaining('MY_SECRET'), false, true);
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

    it('should reject keys with shell injection characters', async () => {
      const source = SecretSourceService.resolveSource('aws-secrets-manager')!;

      await expect(SecretSourceService.fetchSecret(source, '; rm -rf /')).rejects.toThrow('Invalid secret key name');
    });

    it('should reject keys with command substitution', async () => {
      const source = SecretSourceService.resolveSource('aws-secrets-manager')!;

      await expect(SecretSourceService.fetchSecret(source, '$(whoami)')).rejects.toThrow('Invalid secret key name');
    });

    it('should reject keys with backtick command substitution', async () => {
      const source = SecretSourceService.resolveSource('aws-secrets-manager')!;

      await expect(SecretSourceService.fetchSecret(source, '`cat /etc/passwd`')).rejects.toThrow(
        'Invalid secret key name',
      );
    });

    it('should accept keys with valid path-like patterns', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      OrchestratorSystem.Run.mockResolvedValue('secret-value');

      const source = SecretSourceService.resolveSource('aws-secrets-manager')!;
      const result = await SecretSourceService.fetchSecret(source, 'prod/database/password');

      expect(result).toBe('secret-value');
    });

    it('should mask fetched secret values with core.setSecret', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      OrchestratorSystem.Run.mockResolvedValue('super-secret-value');

      const source = SecretSourceService.resolveSource('aws-secrets-manager')!;
      await SecretSourceService.fetchSecret(source, 'MY_SECRET');

      expect(core.setSecret).toHaveBeenCalledWith('super-secret-value');
    });

    it('should not mask empty secret values', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      OrchestratorSystem.Run.mockResolvedValue('');

      const source = SecretSourceService.resolveSource('aws-secrets-manager')!;
      await SecretSourceService.fetchSecret(source, 'MY_SECRET');

      expect(core.setSecret).not.toHaveBeenCalled();
    });

    it('should mask JSON-extracted secret values', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      OrchestratorSystem.Run.mockResolvedValue(JSON.stringify({ value: 'json-secret' }));

      const source = {
        name: 'test-source',
        command: 'fetch {0}',
        parseOutput: 'json-field' as const,
        jsonField: 'value',
      };
      await SecretSourceService.fetchSecret(source, 'KEY');

      expect(core.setSecret).toHaveBeenCalledWith('json-secret');
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

    it('should mask env var values with core.setSecret', () => {
      process.env.TEST_MASK_KEY = 'masked-env-value';
      SecretSourceService.fetchFromEnv('TEST_MASK_KEY');
      expect(core.setSecret).toHaveBeenCalledWith('masked-env-value');
      delete process.env.TEST_MASK_KEY;
    });

    it('should not mask empty env var values', () => {
      const result = SecretSourceService.fetchFromEnv('NONEXISTENT_KEY_99999');
      expect(result).toBe('');
      expect(core.setSecret).not.toHaveBeenCalled();
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
      OrchestratorSystem.Run.mockResolvedValueOnce('secret-1').mockResolvedValueOnce('secret-2');

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

    it('hashicorp-vault uses vault kv get with VAULT_MOUNT', () => {
      const source = SecretSourceService.resolveSource('hashicorp-vault')!;
      expect(source.command).toContain('vault kv get');
      expect(source.command).toContain('VAULT_MOUNT');
      expect(source.command).toContain('-field=value');
    });

    it('hashicorp-vault-kv1 uses vault read for KV v1', () => {
      const source = SecretSourceService.resolveSource('hashicorp-vault-kv1')!;
      expect(source.command).toContain('vault read');
      expect(source.command).toContain('-field=value');
    });

    it('vault alias resolves to same command as hashicorp-vault', () => {
      const vault = SecretSourceService.resolveSource('vault')!;
      const hashicorpVault = SecretSourceService.resolveSource('hashicorp-vault')!;
      expect(vault.command).toBe(hashicorpVault.command);
    });
  });
});
