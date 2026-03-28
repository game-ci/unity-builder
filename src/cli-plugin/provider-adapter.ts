import { ProviderInterface } from '../model/orchestrator/providers/provider-interface';
import { createBuildParametersFromCliOptions } from './build-parameters-adapter';

/**
 * Wraps an orchestrator ProviderInterface constructor so it can be consumed
 * by the CLI's PluginRegistry as a ProviderPlugin.
 *
 * The CLI calls `new ProviderPlugin(yargsOptions)` — this adapter converts
 * the flat yargs options into a BuildParameters object and then instantiates
 * the real provider.
 */
export function createProviderAdapter(
  // eslint-disable-next-line no-unused-vars
  ProviderClass: new (buildParameters: any) => ProviderInterface,
  // eslint-disable-next-line no-unused-vars
): new (options: any) => any {
  return class ProviderAdapter {
    private provider: ProviderInterface;

    constructor(options: Record<string, any>) {
      const buildParameters = createBuildParametersFromCliOptions(options);
      this.provider = new ProviderClass(buildParameters);
    }

    async cleanupWorkflow(buildParameters: any, branchName: string, defaultSecretsArray: any[]) {
      return this.provider.cleanupWorkflow(buildParameters, branchName, defaultSecretsArray);
    }

    async setupWorkflow(buildGuid: string, buildParameters: any, branchName: string, defaultSecretsArray: any[]) {
      return this.provider.setupWorkflow(buildGuid, buildParameters, branchName, defaultSecretsArray);
    }

    async runTaskInWorkflow(
      buildGuid: string,
      image: string,
      commands: string,
      mountdir: string,
      workingdir: string,
      environment: any[],
      secrets: any[],
    ): Promise<string> {
      return this.provider.runTaskInWorkflow(buildGuid, image, commands, mountdir, workingdir, environment, secrets);
    }

    async garbageCollect(
      filter: string,
      previewOnly: boolean,
      olderThan: number,
      fullCache: boolean,
      baseDependencies: boolean,
    ): Promise<string> {
      return this.provider.garbageCollect(filter, previewOnly, olderThan, fullCache, baseDependencies);
    }

    async listResources(): Promise<any[]> {
      return this.provider.listResources();
    }

    async listWorkflow(): Promise<any[]> {
      return this.provider.listWorkflow();
    }

    async watchWorkflow(): Promise<string> {
      return this.provider.watchWorkflow();
    }
  };
}
