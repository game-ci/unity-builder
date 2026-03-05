import AwsBuildPlatform from './providers/aws';
import { BuildParameters, Input } from '..';
import Kubernetes from './providers/k8s';
import OrchestratorLogger from './services/core/orchestrator-logger';
import { OrchestratorStepParameters } from './options/orchestrator-step-parameters';
import { WorkflowCompositionRoot } from './workflows/workflow-composition-root';
import { OrchestratorError } from './error/orchestrator-error';
import { TaskParameterSerializer } from './services/core/task-parameter-serializer';
import * as core from '@actions/core';
import OrchestratorSecret from './options/orchestrator-secret';
import { ProviderInterface } from './providers/provider-interface';
import OrchestratorEnvironmentVariable from './options/orchestrator-environment-variable';
import TestOrchestrator from './providers/test';
import LocalOrchestrator from './providers/local';
import LocalDockerOrchestrator from './providers/docker';
import GcpCloudRunProvider from './providers/gcp-cloud-run';
import AzureAciProvider from './providers/azure-aci';
import RemotePowershellProvider from './providers/remote-powershell';
import GitHubActionsProvider from './providers/github-actions';
import GitLabCIProvider from './providers/gitlab-ci';
import AnsibleProvider from './providers/ansible';
import loadProvider from './providers/provider-loader';
import GitHub from '../github';
import SharedWorkspaceLocking from './services/core/shared-workspace-locking';
import { FollowLogStreamService } from './services/core/follow-log-stream-service';
import OrchestratorResult from './services/core/orchestrator-result';
import OrchestratorOptions from './options/orchestrator-options';
import ResourceTracking from './services/core/resource-tracking';
import { RunnerAvailabilityService } from './services/core/runner-availability-service';

class Orchestrator {
  public static Provider: ProviderInterface;
  public static buildParameters: BuildParameters;
  private static defaultSecrets: OrchestratorSecret[];
  private static orchestratorEnvironmentVariables: OrchestratorEnvironmentVariable[];
  static lockedWorkspace: string = ``;
  public static readonly retainedWorkspacePrefix: string = `retained-workspace`;

  // When true, validates AWS CloudFormation templates even when using local-docker execution
  // This is set by AWS_FORCE_PROVIDER=aws-local mode
  public static validateAwsTemplates: boolean = false;
  public static get isOrchestratorEnvironment() {
    return process.env[`GITHUB_ACTIONS`] !== `true`;
  }
  public static get isOrchestratorAsyncEnvironment() {
    return process.env[`ASYNC_WORKFLOW`] === `true`;
  }
  public static async setup(buildParameters: BuildParameters) {
    OrchestratorLogger.setup();
    OrchestratorLogger.log(`Setting up orchestrator`);
    Orchestrator.buildParameters = buildParameters;
    ResourceTracking.logAllocationSummary('setup');
    await ResourceTracking.logDiskUsageSnapshot('setup');
    if (Orchestrator.buildParameters.githubCheckId === ``) {
      Orchestrator.buildParameters.githubCheckId = await GitHub.createGitHubCheck(
        Orchestrator.buildParameters.buildGuid,
      );
    }
    await Orchestrator.setupSelectedBuildPlatform();
    Orchestrator.defaultSecrets = TaskParameterSerializer.readDefaultSecrets();
    Orchestrator.orchestratorEnvironmentVariables =
      TaskParameterSerializer.createOrchestratorEnvironmentVariables(buildParameters);
    if (GitHub.githubInputEnabled) {
      const buildParameterPropertyNames = Object.getOwnPropertyNames(buildParameters);
      for (const element of Orchestrator.orchestratorEnvironmentVariables) {
        // OrchestratorLogger.log(`Orchestrator output ${Input.ToEnvVarFormat(element.name)} = ${element.value}`);
        core.setOutput(Input.ToEnvVarFormat(element.name), element.value);
      }
      for (const element of buildParameterPropertyNames) {
        // OrchestratorLogger.log(`Orchestrator output ${Input.ToEnvVarFormat(element)} = ${buildParameters[element]}`);
        core.setOutput(Input.ToEnvVarFormat(element), buildParameters[element]);
      }
      core.setOutput(
        Input.ToEnvVarFormat(`buildArtifact`),
        `build-${Orchestrator.buildParameters.buildGuid}.tar${
          Orchestrator.buildParameters.useCompressionStrategy ? '.lz4' : ''
        }`,
      );
    }
    FollowLogStreamService.Reset();
  }

  private static async setupSelectedBuildPlatform() {
    OrchestratorLogger.log(`Orchestrator platform selected ${Orchestrator.buildParameters.providerStrategy}`);

    // Check runner availability and apply fallback if needed
    if (Orchestrator.buildParameters.runnerCheckEnabled && Orchestrator.buildParameters.fallbackProviderStrategy) {
      const owner = OrchestratorOptions.githubOwner;
      const repo = OrchestratorOptions.githubRepoName;
      const token = Orchestrator.buildParameters.gitPrivateToken || process.env.GITHUB_TOKEN || '';

      OrchestratorLogger.log(
        `Checking runner availability (labels: [${Orchestrator.buildParameters.runnerCheckLabels.join(', ')}], min: ${
          Orchestrator.buildParameters.runnerCheckMinAvailable
        })`,
      );

      const result = await RunnerAvailabilityService.checkAvailability(
        owner,
        repo,
        token,
        Orchestrator.buildParameters.runnerCheckLabels,
        Orchestrator.buildParameters.runnerCheckMinAvailable,
      );

      OrchestratorLogger.log(
        `Runner check: ${result.totalRunners} total, ${result.matchingRunners} matching, ${result.idleRunners} idle — ${result.reason}`,
      );

      if (result.shouldFallback) {
        const original = Orchestrator.buildParameters.providerStrategy;
        const fallback = Orchestrator.buildParameters.fallbackProviderStrategy;
        OrchestratorLogger.log(`Falling back from '${original}' to '${fallback}' — ${result.reason}`);
        Orchestrator.buildParameters.providerStrategy = fallback;
        core.setOutput('providerFallbackUsed', 'true');
        core.setOutput('providerFallbackReason', result.reason);
      } else {
        core.setOutput('providerFallbackUsed', 'false');
      }
    }

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
      OrchestratorOptions.awsEndpoint,
      OrchestratorOptions.awsS3Endpoint,
      OrchestratorOptions.awsCloudFormationEndpoint,
      OrchestratorOptions.awsEcsEndpoint,
      OrchestratorOptions.awsKinesisEndpoint,
      OrchestratorOptions.awsCloudWatchLogsEndpoint,
    ]
      .filter((x) => typeof x === 'string')
      .join(' ');
    const isLocalStack = /localstack|localhost|127\.0\.0\.1/i.test(endpointsToCheck);
    let provider = Orchestrator.buildParameters.providerStrategy;
    let validateAwsTemplates = false;

    if (provider === 'aws' && isLocalStack) {
      if (useAwsLocalMode) {
        // aws-local mode: Validate AWS templates but execute via local-docker
        // This provides confidence in AWS CloudFormation without requiring LocalStack Pro
        OrchestratorLogger.log('AWS_FORCE_PROVIDER=aws-local: Validating AWS templates, executing via local-docker');
        validateAwsTemplates = true;
        provider = 'local-docker';
      } else if (forceAwsProvider) {
        // Force full AWS provider (requires LocalStack Pro with ECS support)
        OrchestratorLogger.log(
          'LocalStack endpoints detected but AWS_FORCE_PROVIDER=aws; using full AWS provider (requires ECS support)',
        );
      } else {
        // Auto-fallback to local-docker
        OrchestratorLogger.log('LocalStack endpoints detected; routing provider to local-docker for this run');
        OrchestratorLogger.log(
          'Note: Set AWS_FORCE_PROVIDER=aws-local to validate AWS templates with local-docker execution',
        );
        provider = 'local-docker';
      }
    }

    // Store whether we should validate AWS templates (used by aws-local mode)
    Orchestrator.validateAwsTemplates = validateAwsTemplates;

    // Check for CLI provider executable
    if (Orchestrator.buildParameters.providerExecutable) {
      const { default: CliProvider } = await import('./providers/cli');
      Orchestrator.Provider = new CliProvider(
        Orchestrator.buildParameters.providerExecutable,
        Orchestrator.buildParameters,
      );
      OrchestratorLogger.log(`Using CLI provider executable: ${Orchestrator.buildParameters.providerExecutable}`);
      return;
    }

    switch (provider) {
      case 'k8s':
        Orchestrator.Provider = new Kubernetes(Orchestrator.buildParameters);
        break;
      case 'aws':
        Orchestrator.Provider = new AwsBuildPlatform(Orchestrator.buildParameters);

        // Validate that AWS provider is actually being used when expected
        if (isLocalStack && forceAwsProvider) {
          OrchestratorLogger.log('✓ AWS provider initialized with LocalStack - AWS functionality will be validated');
        } else if (isLocalStack && !forceAwsProvider) {
          OrchestratorLogger.log(
            '⚠ WARNING: AWS provider was requested but LocalStack detected without AWS_FORCE_PROVIDER',
          );
          OrchestratorLogger.log('⚠ This may cause AWS functionality tests to fail validation');
        }
        break;
      case 'test':
        Orchestrator.Provider = new TestOrchestrator();
        break;
      case 'local-docker':
        Orchestrator.Provider = new LocalDockerOrchestrator();
        break;
      case 'local-system':
        Orchestrator.Provider = new LocalOrchestrator();
        break;
      case 'local':
        Orchestrator.Provider = new LocalOrchestrator();
        break;
      case 'gcp-cloud-run':
        OrchestratorLogger.log('⚠ EXPERIMENTAL: GCP Cloud Run Jobs provider');
        Orchestrator.Provider = new GcpCloudRunProvider(Orchestrator.buildParameters);
        break;
      case 'azure-aci':
        OrchestratorLogger.log('⚠ EXPERIMENTAL: Azure Container Instances provider');
        Orchestrator.Provider = new AzureAciProvider(Orchestrator.buildParameters);
      case 'remote-powershell':
        Orchestrator.Provider = new RemotePowershellProvider(Orchestrator.buildParameters);
        break;
      case 'github-actions':
        Orchestrator.Provider = new GitHubActionsProvider(Orchestrator.buildParameters);
        break;
      case 'gitlab-ci':
        Orchestrator.Provider = new GitLabCIProvider(Orchestrator.buildParameters);
        break;
      case 'ansible':
        Orchestrator.Provider = new AnsibleProvider(Orchestrator.buildParameters);
        break;
      default:
        // Try to load provider using the dynamic loader for unknown providers
        try {
          Orchestrator.Provider = await loadProvider(provider, Orchestrator.buildParameters);
        } catch (error: any) {
          OrchestratorLogger.log(`Failed to load provider '${provider}' using dynamic loader: ${error.message}`);
          OrchestratorLogger.log('Falling back to local provider...');
          Orchestrator.Provider = new LocalOrchestrator();
        }
        break;
    }

    // Final validation: Ensure provider matches expectations
    const finalProviderName = Orchestrator.Provider.constructor.name;
    if (Orchestrator.buildParameters.providerStrategy === 'aws' && finalProviderName !== 'AWSBuildEnvironment') {
      OrchestratorLogger.log(`⚠ WARNING: Expected AWS provider but got ${finalProviderName}`);
      OrchestratorLogger.log('⚠ AWS functionality tests may not be validating AWS services correctly');
    }
  }

  static async run(buildParameters: BuildParameters, baseImage: string) {
    if (baseImage.includes(`undefined`)) {
      throw new Error(`baseImage is undefined`);
    }

    try {
      return await Orchestrator.runWithProvider(buildParameters, baseImage);
    } catch (primaryError: any) {
      // Retry on fallback provider if enabled and a fallback is configured
      const fallback = buildParameters.fallbackProviderStrategy;
      const alreadyOnFallback = buildParameters.providerStrategy === fallback;
      if (buildParameters.retryOnFallback && fallback && !alreadyOnFallback) {
        OrchestratorLogger.log(
          `Primary provider '${buildParameters.providerStrategy}' failed: ${primaryError.message}`,
        );
        OrchestratorLogger.log(`Retrying build on fallback provider '${fallback}'...`);
        buildParameters.providerStrategy = fallback;
        core.setOutput('providerFallbackUsed', 'true');
        core.setOutput('providerFallbackReason', `Primary provider failed: ${primaryError.message}`);

        return await Orchestrator.runWithProvider(buildParameters, baseImage);
      }

      throw primaryError;
    }
  }

  private static async runWithProvider(buildParameters: BuildParameters, baseImage: string) {
    await Orchestrator.setup(buildParameters);

    // When aws-local mode is enabled, validate AWS CloudFormation templates
    // This ensures AWS templates are correct even when executing via local-docker
    if (Orchestrator.validateAwsTemplates) {
      await Orchestrator.validateAwsCloudFormationTemplates();
    }

    // Setup workflow with optional init timeout
    await Orchestrator.setupWorkflowWithTimeout();

    try {
      if (buildParameters.maxRetainedWorkspaces > 0) {
        Orchestrator.lockedWorkspace = SharedWorkspaceLocking.NewWorkspaceName();

        const result = await SharedWorkspaceLocking.GetLockedWorkspace(
          Orchestrator.lockedWorkspace,
          Orchestrator.buildParameters.buildGuid,
          Orchestrator.buildParameters,
        );

        if (result) {
          OrchestratorLogger.logLine(`Using retained workspace ${Orchestrator.lockedWorkspace}`);
          Orchestrator.orchestratorEnvironmentVariables = [
            ...Orchestrator.orchestratorEnvironmentVariables,
            { name: `LOCKED_WORKSPACE`, value: Orchestrator.lockedWorkspace },
          ];
        } else {
          OrchestratorLogger.log(`Max retained workspaces reached ${buildParameters.maxRetainedWorkspaces}`);
          buildParameters.maxRetainedWorkspaces = 0;
          Orchestrator.lockedWorkspace = ``;
        }
      }
      await Orchestrator.updateStatusWithBuildParameters();
      const output = await new WorkflowCompositionRoot().run(
        new OrchestratorStepParameters(
          baseImage,
          Orchestrator.orchestratorEnvironmentVariables,
          Orchestrator.defaultSecrets,
        ),
      );
      await Orchestrator.Provider.cleanupWorkflow(
        Orchestrator.buildParameters,
        Orchestrator.buildParameters.branch,
        Orchestrator.defaultSecrets,
      );
      if (!Orchestrator.buildParameters.isCliMode) core.endGroup();
      if (buildParameters.asyncWorkflow && this.isOrchestratorEnvironment && this.isOrchestratorAsyncEnvironment) {
        await GitHub.updateGitHubCheck(Orchestrator.buildParameters.buildGuid, `success`, `success`, `completed`);
      }

      if (BuildParameters.shouldUseRetainedWorkspaceMode(buildParameters)) {
        const workspace = Orchestrator.lockedWorkspace || ``;
        await SharedWorkspaceLocking.ReleaseWorkspace(
          workspace,
          Orchestrator.buildParameters.buildGuid,
          Orchestrator.buildParameters,
        );
        const isLocked = await SharedWorkspaceLocking.IsWorkspaceLocked(workspace, Orchestrator.buildParameters);
        if (isLocked) {
          throw new Error(
            `still locked after releasing ${await SharedWorkspaceLocking.GetAllLocksForWorkspace(
              workspace,
              buildParameters,
            )}`,
          );
        }
        Orchestrator.lockedWorkspace = ``;
      }

      await GitHub.triggerWorkflowOnComplete(Orchestrator.buildParameters.finalHooks);

      if (buildParameters.constantGarbageCollection) {
        Orchestrator.Provider.garbageCollect(``, true, buildParameters.garbageMaxAge, true, true);
      }

      return new OrchestratorResult(buildParameters, output, true, true, false);
    } catch (error: any) {
      OrchestratorLogger.log(JSON.stringify(error, undefined, 4));
      await GitHub.updateGitHubCheck(
        Orchestrator.buildParameters.buildGuid,
        `Failed - Error ${error?.message || error}`,
        `failure`,
        `completed`,
      );
      if (!Orchestrator.buildParameters.isCliMode) core.endGroup();
      await OrchestratorError.handleException(error, Orchestrator.buildParameters, Orchestrator.defaultSecrets);
      throw error;
    }
  }

  /**
   * Runs setupWorkflow with an optional timeout. If providerInitTimeout is set and the
   * provider takes longer than that to initialize, throws an error that triggers
   * retry-on-fallback (if enabled).
   */
  private static async setupWorkflowWithTimeout() {
    const timeoutSeconds = Orchestrator.buildParameters.providerInitTimeout;

    const setupPromise = Orchestrator.Provider.setupWorkflow(
      Orchestrator.buildParameters.buildGuid,
      Orchestrator.buildParameters,
      Orchestrator.buildParameters.branch,
      Orchestrator.defaultSecrets,
    );

    if (timeoutSeconds <= 0) {
      await setupPromise;

      return;
    }

    OrchestratorLogger.log(`Provider init timeout: ${timeoutSeconds}s`);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Provider initialization timed out after ${timeoutSeconds}s`)),
        timeoutSeconds * 1000,
      );
    });

    await Promise.race([setupPromise, timeoutPromise]);
  }

  private static async updateStatusWithBuildParameters() {
    const content = { ...Orchestrator.buildParameters };
    content.gitPrivateToken = ``;
    content.unitySerial = ``;
    content.unityEmail = ``;
    content.unityPassword = ``;
    const jsonContent = JSON.stringify(content, undefined, 4);
    await GitHub.updateGitHubCheck(jsonContent, Orchestrator.buildParameters.buildGuid);
  }

  /**
   * Validates AWS CloudFormation templates without deploying them.
   * Used by aws-local mode to ensure AWS templates are correct when executing via local-docker.
   * This provides confidence that AWS ECS deployments would work with the generated templates.
   */
  private static async validateAwsCloudFormationTemplates() {
    OrchestratorLogger.log('=== AWS CloudFormation Template Validation (aws-local mode) ===');

    try {
      // Import AWS template formations
      const { BaseStackFormation } = await import('./providers/aws/cloud-formations/base-stack-formation');
      const { TaskDefinitionFormation } = await import('./providers/aws/cloud-formations/task-definition-formation');

      // Validate base stack template
      const baseTemplate = BaseStackFormation.formation;
      OrchestratorLogger.log(`✓ Base stack template generated (${baseTemplate.length} chars)`);

      // Check for required resources in base stack
      const requiredBaseResources = ['AWS::EC2::VPC', 'AWS::ECS::Cluster', 'AWS::S3::Bucket', 'AWS::IAM::Role'];
      for (const resource of requiredBaseResources) {
        if (baseTemplate.includes(resource)) {
          OrchestratorLogger.log(`  ✓ Contains ${resource}`);
        } else {
          throw new Error(`Base stack template missing required resource: ${resource}`);
        }
      }

      // Validate task definition template
      const taskTemplate = TaskDefinitionFormation.formation;
      OrchestratorLogger.log(`✓ Task definition template generated (${taskTemplate.length} chars)`);

      // Check for required resources in task definition
      const requiredTaskResources = ['AWS::ECS::TaskDefinition', 'AWS::Logs::LogGroup'];
      for (const resource of requiredTaskResources) {
        if (taskTemplate.includes(resource)) {
          OrchestratorLogger.log(`  ✓ Contains ${resource}`);
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

      OrchestratorLogger.log('=== AWS CloudFormation templates validated successfully ===');
      OrchestratorLogger.log('Note: Actual execution will use local-docker provider');
    } catch (error: any) {
      OrchestratorLogger.log(`AWS CloudFormation template validation failed: ${error.message}`);
      throw error;
    }
  }
}
export default Orchestrator;
