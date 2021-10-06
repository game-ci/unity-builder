import AWSBuildPlatform from './aws/aws-build-platform';
import * as core from '@actions/core';
import { BuildParameters } from '..';
import CloudRunnerNamespace from './services/cloud-runner-namespace';
import { CloudRunnerState } from './state/cloud-runner-state';
import Kubernetes from './k8s/kubernetes-build-platform';
import CloudRunnerLogger from './services/cloud-runner-logger';
import { BuildStep } from './steps/build-step';
import { CompressionStep } from './steps/compression-step';
import { DownloadRepositoryStep } from './steps/download-repository-step';
import { CustomStep } from './workflows/custom-step';
import { EphemeralGitHubRunnerStep } from './workflows/ephemeral-github-runner-step';
import { CloudRunnerStepState } from './state/cloud-runner-step-state';

class CloudRunner {
  private static setup(buildParameters: BuildParameters) {
    CloudRunnerLogger.setup();
    CloudRunnerState.buildGuid = CloudRunnerNamespace.generateBuildName(
      CloudRunnerState.readRunNumber(),
      buildParameters.platform,
    );
    CloudRunnerState.buildParams = buildParameters;
    CloudRunnerState.setupBranchName();
    CloudRunnerState.setupFolderVariables();
    CloudRunnerState.setupDefaultSecrets();
    CloudRunner.setupBuildPlatform();
  }

  public static setupBuildPlatform() {
    switch (CloudRunnerState.buildParams.cloudRunnerCluster) {
      case 'aws':
        CloudRunnerLogger.log('Building with AWS');
        CloudRunnerState.CloudRunnerProviderPlatform = new AWSBuildPlatform(CloudRunnerState.buildParams);
        break;
      default:
      case 'k8s':
        CloudRunnerLogger.log('Building with Kubernetes');
        CloudRunnerState.CloudRunnerProviderPlatform = new Kubernetes(CloudRunnerState.buildParams);
        break;
    }
  }

  static async run(buildParameters: BuildParameters, baseImage) {
    CloudRunner.setup(buildParameters);
    try {
      await CloudRunnerState.CloudRunnerProviderPlatform.setupSharedBuildResources(
        CloudRunnerState.buildGuid,
        CloudRunnerState.buildParams,
        CloudRunnerState.branchName,
        CloudRunnerState.defaultSecrets,
      );
      await CloudRunner.runJob(baseImage.toString());
      await CloudRunnerState.CloudRunnerProviderPlatform.cleanupSharedBuildResources(
        CloudRunnerState.buildGuid,
        CloudRunnerState.buildParams,
        CloudRunnerState.branchName,
        CloudRunnerState.defaultSecrets,
      );
    } catch (error) {
      await CloudRunner.handleException(error);
      throw error;
    }
  }

  private static async runJob(baseImage: any) {
    core.info(`Custom build steps: ${CloudRunnerState.buildParams.customBuildSteps}`);
    if (CloudRunnerState.buildParams.customBuildSteps === '') {
      await CloudRunner.standardBuildAutomation(baseImage);
    } else if (CloudRunnerState.buildParams.customBuildSteps === 'ephemeral') {
      await new EphemeralGitHubRunnerStep().run(
        new CloudRunnerStepState(
          baseImage,
          CloudRunnerState.readBuildEnvironmentVariables(),
          CloudRunnerState.defaultSecrets,
        ),
      );
    } else if (CloudRunnerState.buildParams.customBuildSteps === 'download') {
      await new DownloadRepositoryStep().run(
        new CloudRunnerStepState(
          'alpine/git',
          CloudRunnerState.readBuildEnvironmentVariables(),
          CloudRunnerState.defaultSecrets,
        ),
      );
    } else {
      await CustomStep.runCustomJob(CloudRunnerState.buildParams.customBuildSteps);
    }
  }

  private static async standardBuildAutomation(baseImage: any) {
    CloudRunnerLogger.log(`Cloud Runner is running standard build automation`);

    await new DownloadRepositoryStep().run(
      new CloudRunnerStepState(
        'alpine/git',
        CloudRunnerState.readBuildEnvironmentVariables(),
        CloudRunnerState.defaultSecrets,
      ),
    );
    CloudRunnerLogger.logWithTime('Download repository step time');

    await CustomStep.runCustomJob(CloudRunnerState.buildParams.preBuildSteps);
    CloudRunnerLogger.logWithTime('Pre build step(s) time');

    new BuildStep().run(
      new CloudRunnerStepState(
        baseImage,
        CloudRunnerState.readBuildEnvironmentVariables(),
        CloudRunnerState.defaultSecrets,
      ),
    );
    CloudRunnerLogger.logWithTime('Build time');

    await new CompressionStep().run(
      new CloudRunnerStepState(
        'alpine',
        CloudRunnerState.readBuildEnvironmentVariables(),
        CloudRunnerState.defaultSecrets,
      ),
    );
    CloudRunnerLogger.logWithTime('Compression time');

    await CustomStep.runCustomJob(CloudRunnerState.buildParams.postBuildSteps);
    CloudRunnerLogger.logWithTime('Post build step(s) time');

    CloudRunnerLogger.log(`Cloud Runner finished running standard build automation`);
  }

  private static async handleException(error: unknown) {
    CloudRunnerLogger.error(JSON.stringify(error, undefined, 4));
    core.setFailed('Remote Builder failed');
    await CloudRunnerState.CloudRunnerProviderPlatform.cleanupSharedBuildResources(
      CloudRunnerState.buildGuid,
      CloudRunnerState.buildParams,
      CloudRunnerState.branchName,
      CloudRunnerState.defaultSecrets,
    );
  }
}
export default CloudRunner;
