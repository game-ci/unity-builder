import { CloudFormation, DeleteStackCommand, waitUntilStackDeleteComplete } from '@aws-sdk/client-cloudformation';
import OrchestratorSecret from '../../options/orchestrator-secret';
import OrchestratorEnvironmentVariable from '../../options/orchestrator-environment-variable';
import OrchestratorAWSTaskDef from './orchestrator-aws-task-def';
import AwsTaskRunner from './aws-task-runner';
import { ProviderInterface } from '../provider-interface';
import BuildParameters from '../../../build-parameters';
import OrchestratorLogger from '../../services/core/orchestrator-logger';
import { AWSJobStack as AwsJobStack } from './aws-job-stack';
import { AWSBaseStack as AwsBaseStack } from './aws-base-stack';
import { Input } from '../../..';
import { GarbageCollectionService } from './services/garbage-collection-service';
import { ProviderResource } from '../provider-resource';
import { ProviderWorkflow } from '../provider-workflow';
import { TaskService } from './services/task-service';
import OrchestratorOptions from '../../options/orchestrator-options';
import { AwsClientFactory } from './aws-client-factory';
import ResourceTracking from '../../services/core/resource-tracking';

const DEFAULT_STACK_WAIT_TIME_SECONDS = 600;

function getStackWaitTime(): number {
  const overrideValue = Number(process.env.ORCHESTRATOR_AWS_STACK_WAIT_TIME ?? '');
  if (!Number.isNaN(overrideValue) && overrideValue > 0) {
    return overrideValue;
  }

  return DEFAULT_STACK_WAIT_TIME_SECONDS;
}

class AWSBuildEnvironment implements ProviderInterface {
  private baseStackName: string;

  constructor(buildParameters: BuildParameters) {
    this.baseStackName = buildParameters.awsStackName;
  }
  async listResources(): Promise<ProviderResource[]> {
    await TaskService.getCloudFormationJobStacks();
    await TaskService.getLogGroups();
    await TaskService.getTasks();

    return [];
  }
  listWorkflow(): Promise<ProviderWorkflow[]> {
    throw new Error('Method not implemented.');
  }
  async watchWorkflow(): Promise<string> {
    return await TaskService.watch();
  }

  async listOtherResources(): Promise<string> {
    await TaskService.getLogGroups();

    return '';
  }

  async garbageCollect(
    filter: string,
    previewOnly: boolean,
    // eslint-disable-next-line no-unused-vars
    olderThan: Number,
    // eslint-disable-next-line no-unused-vars
    fullCache: boolean,
    // eslint-disable-next-line no-unused-vars
    baseDependencies: boolean,
  ): Promise<string> {
    await GarbageCollectionService.cleanup(!previewOnly);

    return ``;
  }

  async cleanupWorkflow(
    // eslint-disable-next-line no-unused-vars
    buildParameters: BuildParameters,
    // eslint-disable-next-line no-unused-vars
    branchName: string,
    // eslint-disable-next-line no-unused-vars
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {}
  async setupWorkflow(
    // eslint-disable-next-line no-unused-vars
    buildGuid: string,
    // eslint-disable-next-line no-unused-vars
    buildParameters: BuildParameters,
    // eslint-disable-next-line no-unused-vars
    branchName: string,
    // eslint-disable-next-line no-unused-vars
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {
    process.env.AWS_REGION = Input.region;
    const CF = AwsClientFactory.getCloudFormation();
    await new AwsBaseStack(this.baseStackName).setupBaseStack(CF);
  }

  async runTaskInWorkflow(
    buildGuid: string,
    image: string,
    commands: string,
    mountdir: string,
    workingdir: string,
    environment: OrchestratorEnvironmentVariable[],
    secrets: OrchestratorSecret[],
  ): Promise<string> {
    process.env.AWS_REGION = Input.region;
    ResourceTracking.logAllocationSummary('aws workflow');
    await ResourceTracking.logDiskUsageSnapshot('aws workflow (host)');
    AwsClientFactory.getECS();
    const CF = AwsClientFactory.getCloudFormation();
    AwsClientFactory.getKinesis();
    OrchestratorLogger.log(`AWS Region: ${CF.config.region}`);
    const entrypoint = ['/bin/sh'];
    const startTimeMs = Date.now();
    const taskDef = await new AwsJobStack(this.baseStackName).setupCloudFormations(
      CF,
      buildGuid,
      image,
      entrypoint,
      commands,
      mountdir,
      workingdir,
      secrets,
    );

    let postRunTaskTimeMs;
    try {
      const postSetupStacksTimeMs = Date.now();
      OrchestratorLogger.log(`Setup job time: ${Math.floor((postSetupStacksTimeMs - startTimeMs) / 1000)}s`);
      const { output, shouldCleanup } = await AwsTaskRunner.runTask(taskDef, environment, secrets, commands);
      postRunTaskTimeMs = Date.now();
      OrchestratorLogger.log(`Run job time: ${Math.floor((postRunTaskTimeMs - postSetupStacksTimeMs) / 1000)}s`);
      if (shouldCleanup) {
        await this.cleanupResources(CF, taskDef);
      }
      const postCleanupTimeMs = Date.now();
      if (postRunTaskTimeMs !== undefined)
        OrchestratorLogger.log(`Cleanup job time: ${Math.floor((postCleanupTimeMs - postRunTaskTimeMs) / 1000)}s`);

      return output;
    } catch (error) {
      OrchestratorLogger.log(`error running task ${error}`);
      await this.cleanupResources(CF, taskDef);
      throw error;
    }
  }

  async cleanupResources(CF: CloudFormation, taskDef: OrchestratorAWSTaskDef) {
    const stackWaitTimeSeconds = getStackWaitTime();
    OrchestratorLogger.log(`Cleanup starting (waiting up to ${stackWaitTimeSeconds}s for stack deletion)`);
    await CF.send(new DeleteStackCommand({ StackName: taskDef.taskDefStackName }));
    if (OrchestratorOptions.useCleanupCron) {
      await CF.send(new DeleteStackCommand({ StackName: `${taskDef.taskDefStackName}-cleanup` }));
    }

    await waitUntilStackDeleteComplete(
      {
        client: CF,
        maxWaitTime: stackWaitTimeSeconds,
      },
      {
        StackName: taskDef.taskDefStackName,
      },
    );
    await waitUntilStackDeleteComplete(
      {
        client: CF,
        maxWaitTime: stackWaitTimeSeconds,
      },
      {
        StackName: `${taskDef.taskDefStackName}-cleanup`,
      },
    );
    OrchestratorLogger.log(`Deleted Stack: ${taskDef.taskDefStackName}`);
    OrchestratorLogger.log('Cleanup complete');
  }
}
export default AWSBuildEnvironment;
