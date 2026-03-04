import BuildParameters from '../../build-parameters';
import OrchestratorEnvironmentVariable from '../options/orchestrator-environment-variable';
import OrchestratorSecret from '../options/orchestrator-secret';
import { ProviderResource } from './provider-resource';
import { ProviderWorkflow } from './provider-workflow';

export interface ProviderInterface {
  cleanupWorkflow(
    // eslint-disable-next-line no-unused-vars
    buildParameters: BuildParameters,
    // eslint-disable-next-line no-unused-vars
    branchName: string,
    // eslint-disable-next-line no-unused-vars
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ): any;
  setupWorkflow(
    // eslint-disable-next-line no-unused-vars
    buildGuid: string,
    // eslint-disable-next-line no-unused-vars
    buildParameters: BuildParameters,
    // eslint-disable-next-line no-unused-vars
    branchName: string,
    // eslint-disable-next-line no-unused-vars
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ): any;
  runTaskInWorkflow(
    // eslint-disable-next-line no-unused-vars
    buildGuid: string,
    // eslint-disable-next-line no-unused-vars
    image: string,
    // eslint-disable-next-line no-unused-vars
    commands: string,
    // eslint-disable-next-line no-unused-vars
    mountdir: string,
    // eslint-disable-next-line no-unused-vars
    workingdir: string,
    // eslint-disable-next-line no-unused-vars
    environment: OrchestratorEnvironmentVariable[],
    // eslint-disable-next-line no-unused-vars
    secrets: OrchestratorSecret[],
  ): Promise<string>;
  garbageCollect(
    // eslint-disable-next-line no-unused-vars
    filter: string,
    // eslint-disable-next-line no-unused-vars
    previewOnly: boolean,
    // eslint-disable-next-line no-unused-vars
    olderThan: Number,
    // eslint-disable-next-line no-unused-vars
    fullCache: boolean,
    // eslint-disable-next-line no-unused-vars
    baseDependencies: boolean,
  ): Promise<string>;
  listResources(): Promise<ProviderResource[]>;
  listWorkflow(): Promise<ProviderWorkflow[]>;
  watchWorkflow(): Promise<string>;
}
