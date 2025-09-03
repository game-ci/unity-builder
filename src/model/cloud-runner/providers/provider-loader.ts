import { ProviderInterface } from './provider-interface';
import BuildParameters from '../../build-parameters';

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
  let importedModule: any;
  try {
    importedModule = await import(providerName);
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

  return instance as ProviderInterface;
}
