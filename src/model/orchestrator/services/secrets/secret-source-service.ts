import fs from 'node:fs';
import * as core from '@actions/core';
import OrchestratorLogger from '../core/orchestrator-logger';
import { OrchestratorSystem } from '../core/orchestrator-system';

/**
 * A secret source definition: how to fetch a secret value by key.
 */
export interface SecretSourceDefinition {
  name: string;
  command: string;
  parseOutput?: 'raw' | 'json-field';
  jsonField?: string;
}

/**
 * Validate that a secret key name contains only safe characters.
 * Prevents shell injection when keys are interpolated into commands.
 *
 * Allowed characters: alphanumeric, hyphens, underscores, dots, forward slashes.
 *
 * @param key - The secret key name to validate
 * @returns The validated key (unchanged)
 * @throws Error if the key contains disallowed characters
 */
export function validateSecretKey(key: string): string {
  if (!/^[a-zA-Z0-9\-_./]+$/.test(key)) {
    throw new Error(
      `Invalid secret key name: "${key}". Keys may only contain alphanumeric characters, hyphens, underscores, dots, and forward slashes.`,
    );
  }

  return key;
}

/**
 * Mask a secret value so it does not appear in GitHub Actions logs.
 * Empty or whitespace-only values are skipped (core.setSecret would be a no-op).
 */
function maskSecretValue(value: string): void {
  if (value.trim().length > 0) {
    core.setSecret(value);
  }
}

/**
 * Premade secret sources and custom YAML-based secret source definitions.
 *
 * Premade sources are string shortcuts that expand to shell commands:
 *   - `aws-secrets-manager` -- AWS Secrets Manager
 *   - `aws-parameter-store` -- AWS Systems Manager Parameter Store
 *   - `gcp-secret-manager` -- Google Cloud Secret Manager
 *   - `azure-key-vault` -- Azure Key Vault (requires AZURE_VAULT_NAME env var)
 *   - `hashicorp-vault` -- HashiCorp Vault KV v2 (requires VAULT_ADDR, optionally VAULT_MOUNT)
 *   - `hashicorp-vault-kv1` -- HashiCorp Vault KV v1 (requires VAULT_ADDR, optionally VAULT_MOUNT)
 *   - `env` -- Read from environment variables (no shell command needed)
 *
 * Custom YAML format:
 *   sources:
 *     - name: my-vault
 *       command: 'vault kv get -field=value secret/{0}'
 *     - name: my-api
 *       command: 'curl -s https://secrets.example.com/api/{0}'
 *       parseOutput: json-field
 *       jsonField: value
 */
export class SecretSourceService {
  private static readonly premadeSources: Record<string, SecretSourceDefinition> = {
    'aws-secrets-manager': {
      name: 'aws-secrets-manager',
      command: 'aws secretsmanager get-secret-value --secret-id {0} --query SecretString --output text',
      parseOutput: 'raw',
    },
    'aws-secret-manager': {
      // Alias for backward compatibility (original name in inputPullCommand)
      name: 'aws-secret-manager',
      command: 'aws secretsmanager get-secret-value --secret-id {0} --query SecretString --output text',
      parseOutput: 'raw',
    },
    'aws-parameter-store': {
      name: 'aws-parameter-store',
      command: 'aws ssm get-parameter --name {0} --with-decryption --query Parameter.Value --output text',
      parseOutput: 'raw',
    },
    'gcp-secret-manager': {
      name: 'gcp-secret-manager',
      command: 'gcloud secrets versions access latest --secret="{0}"',
      parseOutput: 'raw',
    },
    'azure-key-vault': {
      name: 'azure-key-vault',
      command: 'az keyvault secret show --vault-name "$AZURE_VAULT_NAME" --name {0} --query value --output tsv',
      parseOutput: 'raw',
    },
    'hashicorp-vault': {
      // HashiCorp Vault KV v2 (default). Requires VAULT_ADDR env var.
      // Optionally set VAULT_MOUNT to override the mount path (default: 'secret').
      // Authentication is handled by VAULT_TOKEN or other Vault auth env vars.
      name: 'hashicorp-vault',
      command: 'vault kv get -mount="${VAULT_MOUNT:-secret}" -field=value {0}',
      parseOutput: 'raw',
    },
    'hashicorp-vault-kv1': {
      // HashiCorp Vault KV v1. Requires VAULT_ADDR env var.
      // Optionally set VAULT_MOUNT to override the mount path (default: 'secret').
      name: 'hashicorp-vault-kv1',
      command: 'vault read -mount="${VAULT_MOUNT:-secret}" -field=value {0}',
      parseOutput: 'raw',
    },
    vault: {
      // Short alias for hashicorp-vault (KV v2)
      name: 'vault',
      command: 'vault kv get -mount="${VAULT_MOUNT:-secret}" -field=value {0}',
      parseOutput: 'raw',
    },
  };

  /**
   * Check if a source name is a known premade source.
   */
  static isPremadeSource(sourceName: string): boolean {
    return sourceName in SecretSourceService.premadeSources;
  }

  /**
   * Get the list of available premade source names.
   */
  static getAvailableSources(): string[] {
    return Object.keys(SecretSourceService.premadeSources);
  }

  /**
   * Resolve a source name to a SecretSourceDefinition.
   *
   * - If the name matches a premade source, returns that definition.
   * - If it looks like a shell command (contains spaces or {0}), wraps it as a custom command.
   * - Otherwise, returns undefined.
   */
  static resolveSource(sourceName: string): SecretSourceDefinition | undefined {
    // Check premade sources
    if (SecretSourceService.isPremadeSource(sourceName)) {
      return SecretSourceService.premadeSources[sourceName];
    }

    // If it contains a placeholder or spaces, treat it as a raw command
    if (sourceName.includes('{0}') || sourceName.includes(' ')) {
      return {
        name: 'custom-command',
        command: sourceName,
        parseOutput: 'raw',
      };
    }

    return undefined;
  }

  /**
   * Load custom secret source definitions from a YAML file.
   *
   * Expected format:
   *   sources:
   *     - name: my-source
   *       command: 'my-tool get-secret {0}'
   *     - name: my-api
   *       command: 'curl -s https://api.example.com/secrets/{0}'
   *       parseOutput: json-field
   *       jsonField: value
   */
  static loadFromYaml(filePath: string): SecretSourceDefinition[] {
    if (!fs.existsSync(filePath)) {
      OrchestratorLogger.logWarning(`Secret source YAML not found: ${filePath}`);

      return [];
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = SecretSourceService.parseSimpleYaml(content);

      return parsed;
    } catch (error: any) {
      OrchestratorLogger.logWarning(`Failed to parse secret source YAML: ${error.message}`);

      return [];
    }
  }

  /**
   * Fetch a secret value using the given source definition.
   *
   * Validates the key against an allowlist pattern before interpolating it
   * into the command string to prevent shell injection. The fetched secret
   * value is masked via core.setSecret() so it does not leak in logs.
   *
   * @param source - The secret source definition to use
   * @param key - The secret key to fetch
   * @returns The secret value, or empty string on failure
   */
  static async fetchSecret(source: SecretSourceDefinition, key: string): Promise<string> {
    // Validate the key to prevent shell injection
    validateSecretKey(key);

    const command = source.command.replace(/\{0\}/g, key);

    try {
      const output = await OrchestratorSystem.Run(command, false, true);

      let value: string;

      if (source.parseOutput === 'json-field' && source.jsonField) {
        try {
          const parsed = JSON.parse(output);
          value = parsed[source.jsonField] || '';
        } catch {
          OrchestratorLogger.logWarning(`Failed to parse JSON output from ${source.name} for key ${key}`);
          value = output.trim();
        }
      } else {
        value = output.trim();
      }

      // Mask the secret value so it does not appear in GitHub Actions logs
      maskSecretValue(value);

      return value;
    } catch (error: any) {
      OrchestratorLogger.logWarning(`Failed to fetch secret '${key}' from ${source.name}: ${error.message}`);

      return '';
    }
  }

  /**
   * Fetch a secret from an environment variable. No shell command needed.
   * The value is masked via core.setSecret() so it does not leak in logs.
   */
  static fetchFromEnv(key: string): string {
    const value = process.env[key] || '';
    maskSecretValue(value);

    return value;
  }

  /**
   * Resolve a source name and fetch all secrets from it.
   *
   * @param sourceName - Premade source name, shell command, or 'env'
   * @param keys - List of secret keys to fetch
   * @returns Map of key -> value
   */
  static async fetchAll(sourceName: string, keys: string[]): Promise<Record<string, string>> {
    const results: Record<string, string> = {};

    if (sourceName === 'env') {
      for (const key of keys) {
        results[key] = SecretSourceService.fetchFromEnv(key);
      }

      return results;
    }

    const source = SecretSourceService.resolveSource(sourceName);
    if (!source) {
      OrchestratorLogger.logWarning(
        `Unknown secret source '${sourceName}'. Available sources: ${SecretSourceService.getAvailableSources().join(
          ', ',
        )}`,
      );

      return results;
    }

    OrchestratorLogger.log(`Fetching ${keys.length} secret(s) from ${source.name}`);

    for (const key of keys) {
      results[key] = await SecretSourceService.fetchSecret(source, key);
    }

    return results;
  }

  /**
   * Simple YAML parser for secret source definitions.
   * Handles the specific structure we expect without requiring a YAML library.
   */
  private static parseSimpleYaml(content: string): SecretSourceDefinition[] {
    const definitions: SecretSourceDefinition[] = [];
    const lines = content.split('\n');
    let current: Partial<SecretSourceDefinition> | null = null;

    for (const rawLine of lines) {
      const line = rawLine.replace(/\r$/, '');
      const trimmed = line.trim();

      if (trimmed === '' || trimmed.startsWith('#')) continue;

      if (trimmed === '- name:' || trimmed.startsWith('- name:')) {
        if (current?.name && current?.command) {
          definitions.push(current as SecretSourceDefinition);
        }

        current = {
          name: trimmed
            .replace('- name:', '')
            .trim()
            .replace(/^['"]|['"]$/g, ''),
          parseOutput: 'raw',
        };
        continue;
      }

      if (current && trimmed.startsWith('command:')) {
        current.command = trimmed
          .replace('command:', '')
          .trim()
          .replace(/^['"]|['"]$/g, '');
      } else if (current && trimmed.startsWith('parseOutput:')) {
        const value = trimmed
          .replace('parseOutput:', '')
          .trim()
          .replace(/^['"]|['"]$/g, '');
        current.parseOutput = value as 'raw' | 'json-field';
      } else if (current && trimmed.startsWith('jsonField:')) {
        current.jsonField = trimmed
          .replace('jsonField:', '')
          .trim()
          .replace(/^['"]|['"]$/g, '');
      }
    }

    if (current?.name && current?.command) {
      definitions.push(current as SecretSourceDefinition);
    }

    return definitions;
  }
}
