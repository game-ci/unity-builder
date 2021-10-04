import * as k8s from '@kubernetes/client-node';
import { BuildParameters } from '../..';
import * as core from '@actions/core';
import { CloudRunnerProviderInterface } from '../services/cloud-runner-provider-interface';
import CloudRunnerSecret from '../services/cloud-runner-secret';
import KubernetesStorage from './kubernetes-storage';
import CloudRunnerEnvironmentVariable from '../services/cloud-runner-environment-variable';
import KubernetesLogging from './kubernetes-logging';
import KubernetesSecret from './kubernetes-secret';
import KubernetesUtilities from './kubernetes-utils';
import waitUntil from 'async-wait-until';
import KubernetesJobSpecFactory from './kubernetes-job-spec-factory';
import KubernetesServiceAccount from './kubernetes-service-account';
import CloudRunnerLogger from '../services/cloud-runner-logger';

class Kubernetes implements CloudRunnerProviderInterface {
  private kubeConfig: k8s.KubeConfig;
  private kubeClient: k8s.CoreV1Api;
  private kubeClientBatch: k8s.BatchV1Api;
  private buildGuid: string = '';
  private buildParameters: BuildParameters;
  private pvcName: string = '';
  private secretName: string = '';
  private jobName: string = '';
  private namespace: string;
  private podName: string = '';
  private containerName: string = '';
  private cleanupCronJobName: string = '';
  private serviceAccountName: string = '';
  private kubeClientBatchBeta: k8s.BatchV1beta1Api;

  constructor(buildParameters: BuildParameters) {
    this.kubeConfig = new k8s.KubeConfig();
    this.kubeConfig.loadFromDefault();
    this.kubeClient = this.kubeConfig.makeApiClient(k8s.CoreV1Api);
    this.kubeClientBatch = this.kubeConfig.makeApiClient(k8s.BatchV1Api);
    this.kubeClientBatchBeta = this.kubeConfig.makeApiClient(k8s.BatchV1beta1Api);
    CloudRunnerLogger.log('Loaded default Kubernetes configuration for this environment');

    this.namespace = 'default';
    this.buildParameters = buildParameters;
  }
  public async setupSharedBuildResources(
    buildGuid: string,
    buildParameters: BuildParameters,
    // eslint-disable-next-line no-unused-vars
    branchName: string,
    // eslint-disable-next-line no-unused-vars
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {
    try {
      this.pvcName = `unity-builder-pvc-${buildGuid}`;
      this.cleanupCronJobName = `unity-builder-cronjob-${buildGuid}`;
      this.serviceAccountName = `service-account-${buildGuid}`;
      await KubernetesStorage.createPersistentVolumeClaim(
        buildParameters,
        this.pvcName,
        this.kubeClient,
        this.namespace,
      );

      await KubernetesServiceAccount.createServiceAccount(this.serviceAccountName, this.namespace, this.kubeClient);
    } catch (error) {
      throw error;
    }
  }

  async runBuildTask(
    buildGuid: string,
    image: string,
    commands: string[],
    mountdir: string,
    workingdir: string,
    environment: CloudRunnerEnvironmentVariable[],
    secrets: CloudRunnerSecret[],
  ): Promise<void> {
    try {
      // setup
      this.buildGuid = buildGuid;
      this.secretName = `build-credentials-${buildGuid}`;
      this.jobName = `unity-builder-job-${buildGuid}`;
      this.containerName = `main`;
      await KubernetesSecret.createSecret(secrets, this.secretName, this.namespace, this.kubeClient);
      const jobSpec = KubernetesJobSpecFactory.getJobSpec(
        commands,
        image,
        mountdir,
        workingdir,
        environment,
        this.buildGuid,
        this.buildParameters,
        this.secretName,
        this.pvcName,
        this.jobName,
        k8s,
      );

      //run
      CloudRunnerLogger.log('Creating build job');
      await this.kubeClientBatch.createNamespacedJob(this.namespace, jobSpec);
      CloudRunnerLogger.log('Job created');
      this.setPodNameAndContainerName(
        await KubernetesUtilities.findPodFromJob(this.kubeClient, this.jobName, this.namespace),
      );
      CloudRunnerLogger.log('Watching pod until running');
      await KubernetesUtilities.watchUntilPodRunning(this.kubeClient, this.podName, this.namespace);
      CloudRunnerLogger.log('Pod running, streaming logs');
      await KubernetesLogging.streamLogs(
        this.kubeConfig,
        this.kubeClient,
        this.jobName,
        this.podName,
        'main',
        this.namespace,
        CloudRunnerLogger.log,
      );
      await this.cleanupTaskResources();
    } catch (error) {
      CloudRunnerLogger.log('Running job failed');
      core.error(JSON.stringify(error, undefined, 4));
      await this.cleanupTaskResources();
      throw error;
    }
  }

  setPodNameAndContainerName(pod: k8s.V1Pod) {
    this.podName = pod.metadata?.name || '';
    this.containerName = pod.status?.containerStatuses?.[0].name || '';
  }

  async cleanupTaskResources() {
    CloudRunnerLogger.log('cleaning up');
    try {
      await this.kubeClientBatch.deleteNamespacedJob(this.jobName, this.namespace);
      await this.kubeClient.deleteNamespacedSecret(this.secretName, this.namespace);
    } catch (error) {
      CloudRunnerLogger.log('Failed to cleanup, error:');
      core.error(JSON.stringify(error, undefined, 4));
      CloudRunnerLogger.log('Abandoning cleanup, build error:');
      throw error;
    }
    try {
      await waitUntil(
        async () => (await this.kubeClientBatch.readNamespacedJob(this.jobName, this.namespace)).body === null,
        {
          timeout: 500000,
          intervalBetweenAttempts: 15000,
        },
      );
    } catch {
      CloudRunnerLogger.log('failed to read the state of the job while cleaning up?');
    }
  }

  async cleanupSharedBuildResources(
    // eslint-disable-next-line no-unused-vars
    buildGuid: string,
    // eslint-disable-next-line no-unused-vars
    buildParameters: BuildParameters,
    // eslint-disable-next-line no-unused-vars
    branchName: string,
    // eslint-disable-next-line no-unused-vars
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {
    await this.kubeClient.deleteNamespacedPersistentVolumeClaim(this.pvcName, this.namespace);
  }
}
export default Kubernetes;
