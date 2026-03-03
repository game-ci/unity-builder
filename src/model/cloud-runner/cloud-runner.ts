import AwsBuildPlatform from './providers/aws';
import { BuildParameters, Input } from '..';
import Kubernetes from './providers/k8s';
import CloudRunnerLogger from './services/core/cloud-runner-logger';
import { CloudRunnerStepParameters } from './options/cloud-runner-step-parameters';
import { WorkflowCompositionRoot } from './workflows/workflow-composition-root';
import { CloudRunnerError } from './error/cloud-runner-error';
import { TaskParameterSerializer } from './services/core/task-parameter-serializer';
import * as core from '@actions/core';
import CloudRunnerSecret from './options/cloud-runner-secret';
import { ProviderInterface } from './providers/provider-interface';
import CloudRunnerEnvironmentVariable from './options/cloud-runner-environment-variable';
import TestCloudRunner from './providers/test';
import LocalCloudRunner from './providers/local';
import LocalDockerCloudRunner from './providers/docker';
import loadProvider from './providers/provider-loader';
import GitHub from '../github';
import SharedWorkspaceLocking from './services/core/shared-workspace-locking';
import { FollowLogStreamService } from './services/core/follow-log-stream-service';
import CloudRunnerResult from './services/core/cloud-runner-result';
import CloudRunnerOptions from './options/cloud-runner-options';
import ResourceTracking from './services/core/resource-tracking';

class CloudRunner {
  public static Provider: ProviderInterface;
  public static buildParameters: BuildParameters;
  private static defaultSecrets: CloudRunnerSecret[];
  private static cloudRunnerEnvironmentVariables: CloudRunnerEnvironmentVariable[];
  static lockedWorkspace: string = ``;
  public static readonly retainedWorkspacePrefix: string = `retained-workspace`;

  // When true, validates AWS CloudFormation templates even when using local-docker execution
  // This is set by AWS_FORCE_PROVIDER=aws-local mode
  public static validateAwsTemplates: boolean = false;
  public static get isCloudRunnerEnvironment() {
    return process.env[`GITHUB_ACTIONS`] !== `true`;
  }
  public static get isCloudRunnerAsyncEnvironment() {
    return process.env[`ASYNC_WORKFLOW`] === `true`;
  }
  public static async setup(buildParameters: BuildParameters) {
    CloudRunnerLogger.setup();
    CloudRunnerLogger.log(`Setting up cloud runner`);
    CloudRunner.buildParameters = buildParameters;
    ResourceTracking.logAllocationSummary('setup');
    await ResourceTracking.logDiskUsageSnapshot('setup');
    if (CloudRunner.buildParameters.githubCheckId === ``) {
      CloudRunner.buildParameters.githubCheckId = await GitHub.createGitHubCheck(CloudRunner.buildParameters.buildGuid);
    }
    await CloudRunner.setupSelectedBuildPlatform();
    CloudRunner.defaultSecrets = TaskParameterSerializer.readDefaultSecrets();
    CloudRunner.cloudRunnerEnvironmentVariables =
      TaskParameterSerializer.createCloudRunnerEnvironmentVariables(buildParameters);
    if (GitHub.githubInputEnabled) {
      const buildParameterPropertyNames = Object.getOwnPropertyNames(buildParameters);
      for (const element of CloudRunner.cloudRunnerEnvironmentVariables) {
        // CloudRunnerLogger.log(`Cloud Runner output ${Input.ToEnvVarFormat(element.name)} = ${element.value}`);
        core.setOutput(Input.ToEnvVarFormat(element.name), element.value);
      }
      for (const element of buildParameterPropertyNames) {
        // CloudRunnerLogger.log(`Cloud Runner output ${Input.ToEnvVarFormat(element)} = ${buildParameters[element]}`);
        core.setOutput(Input.ToEnvVarFormat(element), buildParameters[element]);
      }
      core.setOutput(
        Input.ToEnvVarFormat(`buildArtifact`),
        `build-${CloudRunner.buildParameters.buildGuid}.tar${
          CloudRunner.buildParameters.useCompressionStrategy ? '.lz4' : ''
        }`,
      );
    }
    FollowLogStreamService.Reset();
  }

  private static async setupSelectedBuildPlatform() {
    CloudRunnerLogger.log(`Cloud Runner platform selected ${CloudRunner.buildParameters.providerStrategy}`);

    // Detect LocalStack endpoints and handle AWS provider appropriately
    // AWS_FORCE_PROVIDER options:
    //   - 'aws': Force AWS provider (requires LocalStack Pro with ECS support)
    //   - 'aws-local': Validate AWS templates/config but execute via local-docker (for CI without ECS)
    //   - unset/other: Auto-fallback to local-docker when LocalStack detected
    const awsForceProvider = process.env.AWS_FORCE_PROVIDER || '';
    const forceAwsProvider = awsForceProvider === 'aws' || awsForceProvider === 'true';
    const useAwsLocalMode = awsForceProvider === 'aws-local';
    const endpointsToCheck = [
      process.env.AWS_ENDPOINT,
      process.env.AWS_S3_ENDPOINT,
      process.env.AWS_CLOUD_FORMATION_ENDPOINT,
      process.env.AWS_ECS_ENDPOINT,
      process.env.AWS_KINESIS_ENDPOINT,
      process.env.AWS_CLOUD_WATCH_LOGS_ENDPOINT,
      CloudRunnerOptions.awsEndpoint,
      CloudRunnerOptions.awsS3Endpoint,
      CloudRunnerOptions.awsCloudFormationEndpoint,
      CloudRunnerOptions.awsEcsEndpoint,
      CloudRunnerOptions.awsKinesisEndpoint,
      CloudRunnerOptions.awsCloudWatchLogsEndpoint,
    ]
      .filter((x) => typeof x === 'string')
      .join(' ');
    const isLocalStack = /localstack|localhost|127\.0\.0\.1/i.test(endpointsToCheck);
    let provider = CloudRunner.buildParameters.providerStrategy;
    let validateAwsTemplates = false;

    if (provider === 'aws' && isLocalStack) {
      if (useAwsLocalMode) {
        // aws-local mode: Validate AWS templates but execute via local-docker
        // This provides confidence in AWS CloudFormation without requiring LocalStack Pro
        CloudRunnerLogger.log('AWS_FORCE_PROVIDER=aws-local: Validating AWS templates, executing via local-docker');
        validateAwsTemplates = true;
        provider = 'local-docker';
      } else if (forceAwsProvider) {
        // Force full AWS provider (requires LocalStack Pro with ECS support)
        CloudRunnerLogger.log(
          'LocalStack endpoints detected but AWS_FORCE_PROVIDER=aws; using full AWS provider (requires ECS support)',
        );
      } else {
        // Auto-fallback to local-docker
        CloudRunnerLogger.log('LocalStack endpoints detected; routing provider to local-docker for this run');
        CloudRunnerLogger.log(
          'Note: Set AWS_FORCE_PROVIDER=aws-local to validate AWS templates with local-docker execution',
        );
        provider = 'local-docker';
      }
    }

    // Store whether we should validate AWS templates (used by aws-local mode)
    CloudRunner.validateAwsTemplates = validateAwsTemplates;

    switch (provider) {
      case 'k8s':
        CloudRunner.Provider = new Kubernetes(CloudRunner.buildParameters);
        break;
      case 'aws':
        CloudRunner.Provider = new AwsBuildPlatform(CloudRunner.buildParameters);

        // Validate that AWS provider is actually being used when expected
        if (isLocalStack && forceAwsProvider) {
          CloudRunnerLogger.log('✓ AWS provider initialized with LocalStack - AWS functionality will be validated');
        } else if (isLocalStack && !forceAwsProvider) {
          CloudRunnerLogger.log(
            '⚠ WARNING: AWS provider was requested but LocalStack detected without AWS_FORCE_PROVIDER',
          );
          CloudRunnerLogger.log('⚠ This may cause AWS functionality tests to fail validation');
        }
        break;
      case 'test':
        CloudRunner.Provider = new TestCloudRunner();
        break;
      case 'local-docker':
        CloudRunner.Provider = new LocalDockerCloudRunner();
        break;
      case 'local-system':
        CloudRunner.Provider = new LocalCloudRunner();
        break;
      case 'local':
        CloudRunner.Provider = new LocalCloudRunner();
        break;
      default:
        // Try to load provider using the dynamic loader for unknown providers
        try {
          CloudRunner.Provider = await loadProvider(provider, CloudRunner.buildParameters);
        } catch (error: any) {
          CloudRunnerLogger.log(`Failed to load provider '${provider}' using dynamic loader: ${error.message}`);
          CloudRunnerLogger.log('Falling back to local provider...');
          CloudRunner.Provider = new LocalCloudRunner();
        }
        break;
    }

    // Final validation: Ensure provider matches expectations
    const finalProviderName = CloudRunner.Provider.constructor.name;
    if (CloudRunner.buildParameters.providerStrategy === 'aws' && finalProviderName !== 'AWSBuildEnvironment') {
      CloudRunnerLogger.log(`⚠ WARNING: Expected AWS provider but got ${finalProviderName}`);
      CloudRunnerLogger.log('⚠ AWS functionality tests may not be validating AWS services correctly');
    }
  }

  static async run(buildParameters: BuildParameters, baseImage: string) {
    if (baseImage.includes(`undefined`)) {
      throw new Error(`baseImage is undefined`);
    }
    await CloudRunner.setup(buildParameters);

    // When aws-local mode is enabled, validate AWS CloudFormation templates
    // This ensures AWS templates are correct even when executing via local-docker
    if (CloudRunner.validateAwsTemplates) {
      await CloudRunner.validateAwsCloudFormationTemplates();
    }
    await CloudRunner.Provider.setupWorkflow(
      CloudRunner.buildParameters.buildGuid,
      CloudRunner.buildParameters,
      CloudRunner.buildParameters.branch,
      CloudRunner.defaultSecrets,
    );
    try {
      if (buildParameters.maxRetainedWorkspaces > 0) {
        CloudRunner.lockedWorkspace = SharedWorkspaceLocking.NewWorkspaceName();

        const result = await SharedWorkspaceLocking.GetLockedWorkspace(
          CloudRunner.lockedWorkspace,
          CloudRunner.buildParameters.buildGuid,
          CloudRunner.buildParameters,
        );

        if (result) {
          CloudRunnerLogger.logLine(`Using retained workspace ${CloudRunner.lockedWorkspace}`);
          CloudRunner.cloudRunnerEnvironmentVariables = [
            ...CloudRunner.cloudRunnerEnvironmentVariables,
            { name: `LOCKED_WORKSPACE`, value: CloudRunner.lockedWorkspace },
          ];
        } else {
          CloudRunnerLogger.log(`Max retained workspaces reached ${buildParameters.maxRetainedWorkspaces}`);
          buildParameters.maxRetainedWorkspaces = 0;
          CloudRunner.lockedWorkspace = ``;
        }
      }
      await CloudRunner.updateStatusWithBuildParameters();
      const output = await new WorkflowCompositionRoot().run(
        new CloudRunnerStepParameters(
          baseImage,
          CloudRunner.cloudRunnerEnvironmentVariables,
          CloudRunner.defaultSecrets,
        ),
      );
      await CloudRunner.Provider.cleanupWorkflow(
        CloudRunner.buildParameters,
        CloudRunner.buildParameters.branch,
        CloudRunner.defaultSecrets,
      );
      if (!CloudRunner.buildParameters.isCliMode) core.endGroup();
      if (buildParameters.asyncWorkflow && this.isCloudRunnerEnvironment && this.isCloudRunnerAsyncEnvironment) {
        await GitHub.updateGitHubCheck(CloudRunner.buildParameters.buildGuid, `success`, `success`, `completed`);
      }

      if (BuildParameters.shouldUseRetainedWorkspaceMode(buildParameters)) {
        const workspace = CloudRunner.lockedWorkspace || ``;
        await SharedWorkspaceLocking.ReleaseWorkspace(
          workspace,
          CloudRunner.buildParameters.buildGuid,
          CloudRunner.buildParameters,
        );
        const isLocked = await SharedWorkspaceLocking.IsWorkspaceLocked(workspace, CloudRunner.buildParameters);
        if (isLocked) {
          throw new Error(
            `still locked after releasing ${await SharedWorkspaceLocking.GetAllLocksForWorkspace(
              workspace,
              buildParameters,
            )}`,
          );
        }
        CloudRunner.lockedWorkspace = ``;
      }

      await GitHub.triggerWorkflowOnComplete(CloudRunner.buildParameters.finalHooks);

      if (buildParameters.constantGarbageCollection) {
        CloudRunner.Provider.garbageCollect(``, true, buildParameters.garbageMaxAge, true, true);
      }

      return new CloudRunnerResult(buildParameters, output, true, true, false);
    } catch (error: any) {
      CloudRunnerLogger.log(JSON.stringify(error, undefined, 4));
      await GitHub.updateGitHubCheck(
        CloudRunner.buildParameters.buildGuid,
        `Failed - Error ${error?.message || error}`,
        `failure`,
        `completed`,
      );
      if (!CloudRunner.buildParameters.isCliMode) core.endGroup();
      await CloudRunnerError.handleException(error, CloudRunner.buildParameters, CloudRunner.defaultSecrets);
      throw error;
    }
  }

  private static async updateStatusWithBuildParameters() {
    const content = { ...CloudRunner.buildParameters };
    content.gitPrivateToken = ``;
    content.unitySerial = ``;
    content.unityEmail = ``;
    content.unityPassword = ``;
    const jsonContent = JSON.stringify(content, undefined, 4);
    await GitHub.updateGitHubCheck(jsonContent, CloudRunner.buildParameters.buildGuid);
  }

  /**
   * Validates AWS CloudFormation templates without deploying them.
   * Used by aws-local mode to ensure AWS templates are correct when executing via local-docker.
   * This provides confidence that AWS ECS deployments would work with the generated templates.
   */
  private static async validateAwsCloudFormationTemplates() {
    CloudRunnerLogger.log('=== AWS CloudFormation Template Validation (aws-local mode) ===');

    try {
      // Import AWS template formations
      const { BaseStackFormation } = await import('./providers/aws/cloud-formations/base-stack-formation');
      const { TaskDefinitionFormation } = await import('./providers/aws/cloud-formations/task-definition-formation');

      // Validate base stack template
      const baseTemplate = BaseStackFormation.formation;
      CloudRunnerLogger.log(`✓ Base stack template generated (${baseTemplate.length} chars)`);

      // Check for required resources in base stack
      const requiredBaseResources = ['AWS::EC2::VPC', 'AWS::ECS::Cluster', 'AWS::S3::Bucket', 'AWS::IAM::Role'];
      for (const resource of requiredBaseResources) {
        if (baseTemplate.includes(resource)) {
          CloudRunnerLogger.log(`  ✓ Contains ${resource}`);
        } else {
          throw new Error(`Base stack template missing required resource: ${resource}`);
        }
      }

      // Validate task definition template
      const taskTemplate = TaskDefinitionFormation.formation;
      CloudRunnerLogger.log(`✓ Task definition template generated (${taskTemplate.length} chars)`);

      // Check for required resources in task definition
      const requiredTaskResources = ['AWS::ECS::TaskDefinition', 'AWS::Logs::LogGroup'];
      for (const resource of requiredTaskResources) {
        if (taskTemplate.includes(resource)) {
          CloudRunnerLogger.log(`  ✓ Contains ${resource}`);
        } else {
          throw new Error(`Task definition template missing required resource: ${resource}`);
        }
      }

      // Validate YAML syntax by checking for common patterns
      if (!baseTemplate.includes('AWSTemplateFormatVersion')) {
        throw new Error('Base stack template missing AWSTemplateFormatVersion');
      }
      if (!taskTemplate.includes('AWSTemplateFormatVersion')) {
        throw new Error('Task definition template missing AWSTemplateFormatVersion');
      }

      CloudRunnerLogger.log('=== AWS CloudFormation templates validated successfully ===');
      CloudRunnerLogger.log('Note: Actual execution will use local-docker provider');
    } catch (error: any) {
      CloudRunnerLogger.log(`AWS CloudFormation template validation failed: ${error.message}`);
      throw error;
    }
  }
}
export default CloudRunner;
