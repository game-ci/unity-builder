import Input from '../../input';
import { GenericInputReader } from '../../input-readers/generic-input-reader';
import OrchestratorOptions from './orchestrator-options';
import { SecretSourceService } from '../services/secrets/secret-source-service';
import OrchestratorLogger from '../services/core/orchestrator-logger';

const formatFunction = (value: string, arguments_: any[]) => {
  for (const element of arguments_) {
    value = value.replace(`{${element.key}}`, element.value);
  }

  return value;
};

class OrchestratorQueryOverride {
  static queryOverrides: { [key: string]: string } | undefined;

  public static query(key: string, alternativeKey: string) {
    if (OrchestratorQueryOverride.queryOverrides && OrchestratorQueryOverride.queryOverrides[key] !== undefined) {
      return OrchestratorQueryOverride.queryOverrides[key];
    }
    if (
      OrchestratorQueryOverride.queryOverrides &&
      alternativeKey &&
      OrchestratorQueryOverride.queryOverrides[alternativeKey] !== undefined
    ) {
      return OrchestratorQueryOverride.queryOverrides[alternativeKey];
    }

    return;
  }

  private static shouldUseOverride(query: string) {
    if (OrchestratorOptions.inputPullCommand !== '') {
      if (OrchestratorOptions.pullInputList.length > 0) {
        const doesInclude =
          OrchestratorOptions.pullInputList.includes(query) ||
          OrchestratorOptions.pullInputList.includes(Input.ToEnvVarFormat(query));

        return doesInclude ? true : false;
      } else {
        return true;
      }
    }
  }

  private static async queryOverride(query: string) {
    if (!this.shouldUseOverride(query)) {
      throw new Error(`Should not be trying to run override query on ${query}`);
    }

    return await GenericInputReader.Run(
      formatFunction(OrchestratorOptions.inputPullCommand, [{ key: 0, value: query }]),
    );
  }

  /**
   * Populate query overrides using either:
   * 1. Premade/custom secret sources (via secretSource input), or
   * 2. Shell command (via inputPullCommand, legacy approach)
   *
   * The secretSource input takes precedence if set. It supports:
   * - Premade names: 'aws-secrets-manager', 'aws-parameter-store', 'gcp-secret-manager', 'azure-key-vault', 'env'
   * - Custom commands: any string containing {0} placeholder
   * - YAML file path: a path ending in .yml or .yaml containing custom source definitions
   */
  public static async PopulateQueryOverrideInput() {
    const queries = OrchestratorOptions.pullInputList;
    OrchestratorQueryOverride.queryOverrides = {};

    const secretSource = OrchestratorOptions.secretSource;

    // Use SecretSourceService if secretSource is configured
    if (secretSource) {
      OrchestratorLogger.log(`Using secret source: ${secretSource}`);

      // YAML file: load definitions and use the first source
      if (secretSource.endsWith('.yml') || secretSource.endsWith('.yaml')) {
        const definitions = SecretSourceService.loadFromYaml(secretSource);
        if (definitions.length > 0) {
          OrchestratorLogger.log(`Loaded ${definitions.length} secret source(s) from ${secretSource}`);
          for (const key of queries) {
            OrchestratorQueryOverride.queryOverrides[key] = await SecretSourceService.fetchSecret(
              definitions[0],
              key,
            );
          }
        }

        return;
      }

      // Premade or custom command source
      const results = await SecretSourceService.fetchAll(secretSource, queries);
      Object.assign(OrchestratorQueryOverride.queryOverrides, results);

      return;
    }

    // Legacy: use inputPullCommand if set
    for (const element of queries) {
      if (OrchestratorQueryOverride.shouldUseOverride(element)) {
        OrchestratorQueryOverride.queryOverrides[element] = await OrchestratorQueryOverride.queryOverride(element);
      }
    }
  }
}
export default OrchestratorQueryOverride;
