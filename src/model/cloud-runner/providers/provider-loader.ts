import { ProviderInterface } from './provider-interface';
import BuildParameters from '../../build-parameters';
import CloudRunnerLogger from '../services/core/cloud-runner-logger';
import { parseProviderSource, logProviderSource, ProviderSourceInfo } from './provider-url-parser';
import { ProviderGitManager } from './provider-git-manager';

// import path from 'path'; // Not currently used

/**
 * Dynamically load a provider package by name, URL, or path.
 * @param providerSource Provider source (name, URL, or path)
 * @param buildParameters Build parameters passed to the provider constructor
 * @throws Error when the provider cannot be loaded or does not implement ProviderInterface
 */
export default async function loadProvider(
  providerSource: string,
  buildParameters: BuildParameters,
): Promise<ProviderInterface> {
  CloudRunnerLogger.log(`Loading provider: ${providerSource}`);

  // Parse the provider source to determine its type
  const sourceInfo = parseProviderSource(providerSource);
  logProviderSource(providerSource, sourceInfo);

  let modulePath: string;
  let importedModule: any;

  try {
    // Handle different source types
    switch (sourceInfo.type) {
      case 'github': {
        CloudRunnerLogger.log(`Processing GitHub repository: ${sourceInfo.owner}/${sourceInfo.repo}`);

        // Ensure the repository is available locally
        const localRepoPath = await ProviderGitManager.ensureRepositoryAvailable(sourceInfo);

        // Get the path to the provider module within the repository
        modulePath = ProviderGitManager.getProviderModulePath(sourceInfo, localRepoPath);

        CloudRunnerLogger.log(`Loading provider from: ${modulePath}`);
        break;
      }

      case 'local': {
        modulePath = sourceInfo.path;
        CloudRunnerLogger.log(`Loading provider from local path: ${modulePath}`);
        break;
      }

      case 'npm': {
        modulePath = sourceInfo.packageName;
        CloudRunnerLogger.log(`Loading provider from NPM package: ${modulePath}`);
        break;
      }

      default: {
        // Fallback to built-in providers or direct import
        const providerModuleMap: Record<string, string> = {
          aws: './aws',
          k8s: './k8s',
          test: './test',
          'local-docker': './docker',
          'local-system': './local',
          local: './local',
        };

        modulePath = providerModuleMap[providerSource] || providerSource;
        CloudRunnerLogger.log(`Loading provider from module path: ${modulePath}`);
        break;
      }
    }

    // Import the module
    importedModule = await import(modulePath);
  } catch (error) {
    throw new Error(`Failed to load provider package '${providerSource}': ${(error as Error).message}`);
  }

  // Extract the provider class/function
  const Provider = importedModule.default || importedModule;

  // Validate that we have a constructor
  if (typeof Provider !== 'function') {
    throw new TypeError(`Provider package '${providerSource}' does not export a constructor function`);
  }

  // Instantiate the provider
  let instance: any;
  try {
    instance = new Provider(buildParameters);
  } catch (error) {
    throw new Error(`Failed to instantiate provider '${providerSource}': ${(error as Error).message}`);
  }

  // Validate that the instance implements the required interface
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
      throw new TypeError(
        `Provider package '${providerSource}' does not implement ProviderInterface. Missing method '${method}'.`,
      );
    }
  }

  CloudRunnerLogger.log(`Successfully loaded provider: ${providerSource}`);

  return instance as ProviderInterface;
}

/**
 * ProviderLoader class for backward compatibility and additional utilities
 */
export class ProviderLoader {
  /**
   * Dynamically loads a provider by name, URL, or path (wrapper around loadProvider function)
   * @param providerSource - The provider source (name, URL, or path) to load
   * @param buildParameters - Build parameters to pass to the provider constructor
   * @returns Promise<ProviderInterface> - The loaded provider instance
   * @throws Error if provider package is missing or doesn't implement ProviderInterface
   */
  static async loadProvider(providerSource: string, buildParameters: BuildParameters): Promise<ProviderInterface> {
    return loadProvider(providerSource, buildParameters);
  }

  /**
   * Gets a list of available provider names
   * @returns string[] - Array of available provider names
   */
  static getAvailableProviders(): string[] {
    return ['aws', 'k8s', 'test', 'local-docker', 'local-system', 'local'];
  }

  /**
   * Cleans up old cached repositories
   * @param maxAgeDays Maximum age in days for cached repositories (default: 30)
   */
  static async cleanupCache(maxAgeDays: number = 30): Promise<void> {
    await ProviderGitManager.cleanupOldRepositories(maxAgeDays);
  }

  /**
   * Gets information about a provider source without loading it
   * @param providerSource The provider source to analyze
   * @returns ProviderSourceInfo object with parsed details
   */
  static analyzeProviderSource(providerSource: string): ProviderSourceInfo {
    return parseProviderSource(providerSource);
  }
}
