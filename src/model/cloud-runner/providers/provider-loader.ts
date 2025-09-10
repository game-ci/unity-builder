import { ProviderInterface } from './provider-interface';
import BuildParameters from '../../build-parameters';
import CloudRunnerLogger from '../services/core/cloud-runner-logger';

/**
 * Dynamically load a provider package by name.
 * @param providerName Name of the provider package to load
 * @param buildParameters Build parameters passed to the provider constructor
 * @throws Error when the provider cannot be loaded or does not implement ProviderInterface
 */
export default async function loadProvider(
  providerName: string,
  buildParameters: BuildParameters,
): Promise<ProviderInterface> {
  CloudRunnerLogger.log(`Loading provider: ${providerName}`);
  
  let importedModule: any;
  try {
    // Map provider names to their module paths for built-in providers
    const providerModuleMap: Record<string, string> = {
      'aws': './aws',
      'k8s': './k8s',
      'test': './test',
      'local-docker': './docker',
      'local-system': './local',
      'local': './local'
    };

    const modulePath = providerModuleMap[providerName] || providerName;
    importedModule = await import(modulePath);
  } catch (error) {
    throw new Error(`Failed to load provider package '${providerName}': ${(error as Error).message}`);
  }

  const Provider = importedModule.default || importedModule;
  let instance: any;
  try {
    instance = new Provider(buildParameters);
  } catch (error) {
    throw new Error(`Failed to instantiate provider '${providerName}': ${(error as Error).message}`);
  }

  const requiredMethods = [
    'cleanupWorkflow',
    'setupWorkflow',
    'runTaskInWorkflow',
    'garbageCollect',
    'listResources',
    'listWorkflow',
    'watchWorkflow',
  ];

  for (const method of requiredMethods) {
    if (typeof instance[method] !== 'function') {
      throw new Error(
        `Provider package '${providerName}' does not implement ProviderInterface. Missing method '${method}'.`,
      );
    }
  }

  CloudRunnerLogger.log(`Successfully loaded provider: ${providerName}`);
  return instance as ProviderInterface;
}

/**
 * ProviderLoader class for backward compatibility and additional utilities
 */
export class ProviderLoader {
  /**
   * Dynamically loads a provider by name (wrapper around loadProvider function)
   * @param providerName - The name of the provider to load
   * @param buildParameters - Build parameters to pass to the provider constructor
   * @returns Promise<ProviderInterface> - The loaded provider instance
   * @throws Error if provider package is missing or doesn't implement ProviderInterface
   */
  static async loadProvider(providerName: string, buildParameters: BuildParameters): Promise<ProviderInterface> {
    return loadProvider(providerName, buildParameters);
  }

  /**
   * Gets a list of available provider names
   * @returns string[] - Array of available provider names
   */
  static getAvailableProviders(): string[] {
    return ['aws', 'k8s', 'test', 'local-docker', 'local-system', 'local'];
  }
}
