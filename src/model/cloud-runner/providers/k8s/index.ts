import * as k8s from '@kubernetes/client-node';
import { BuildParameters } from '../../..';
import * as core from '@actions/core';
import { ProviderInterface } from '../provider-interface';
import CloudRunnerSecret from '../../services/cloud-runner-secret';
import KubernetesStorage from './kubernetes-storage';
import CloudRunnerEnvironmentVariable from '../../services/cloud-runner-environment-variable';
import KubernetesTaskRunner from './kubernetes-task-runner';
import KubernetesSecret from './kubernetes-secret';
import waitUntil from 'async-wait-until';
import KubernetesJobSpecFactory from './kubernetes-job-spec-factory';
import KubernetesServiceAccount from './kubernetes-service-account';
import CloudRunnerLogger from '../../services/cloud-runner-logger';
import { CoreV1Api } from '@kubernetes/client-node';
import CloudRunner from '../../cloud-runner';

class Kubernetes implements ProviderInterface {
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

  constructor(buildParameters: BuildParameters) {
    this.kubeConfig = new k8s.KubeConfig();
    this.kubeConfig.loadFromDefault();
    this.kubeClient = this.kubeConfig.makeApiClient(k8s.CoreV1Api);
    this.kubeClientBatch = this.kubeConfig.makeApiClient(k8s.BatchV1Api);
    CloudRunnerLogger.log('Loaded default Kubernetes configuration for this environment');

    this.namespace = 'default';
    this.buildParameters = buildParameters;
  }
  listWorkflow(): Promise<string[]> {
    throw new Error('Method not implemented.');
  }
  inspectWorkflow(): Promise<string> {
    throw new Error('Method not implemented.');
  }
  inspectResources(): Promise<string> {
    throw new Error('Method not implemented.');
  }
  watchWorkflow(): Promise<string> {
    throw new Error('Method not implemented.');
  }
  listResources(): Promise<string[]> {
    throw new Error('Method not implemented.');
  }
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
  ): Promise<string> {
    throw new Error('Method not implemented.');
  }
  public async setupWorkflow(
    buildGuid: string,
    buildParameters: BuildParameters,
    // eslint-disable-next-line no-unused-vars
    branchName: string,
    // eslint-disable-next-line no-unused-vars
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {
    try {
      const id = buildParameters.retainWorkspace ? CloudRunner.lockedWorkspace : buildParameters.buildGuid;
      this.pvcName = `unity-builder-pvc-${id}`;
      this.cleanupCronJobName = `unity-builder-cronjob-${id}`;
      this.serviceAccountName = `service-account-${buildParameters.buildGuid}`;
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

  async runTaskInWorkflow(
    buildGuid: string,
    image: string,
    commands: string,
    mountdir: string,
    workingdir: string,
    environment: CloudRunnerEnvironmentVariable[],
    secrets: CloudRunnerSecret[],
  ): Promise<string> {
    try {
      // Setup
      this.buildGuid = buildGuid;
      this.secretName = `build-credentials-${buildGuid}`;
      this.jobName = `unity-builder-job-${buildGuid}`;
      this.containerName = `main`;
      await this.createSecret(secrets);
      await this.createNamespacedJob(commands, image, mountdir, workingdir, environment, secrets);
      this.setPodNameAndContainerName(await Kubernetes.findPodFromJob(this.kubeClient, this.jobName, this.namespace));
      CloudRunnerLogger.log('Watching pod until running');
      let output = '';
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          await KubernetesTaskRunner.watchUntilPodRunning(this.kubeClient, this.podName, this.namespace);
          CloudRunnerLogger.log('Pod running, streaming logs');
          output = await KubernetesTaskRunner.runTask(
            this.kubeConfig,
            this.kubeClient,
            this.jobName,
            this.podName,
            'main',
            this.namespace,
          );
          break;
        } catch (error: any) {
          if (error.message.includes(`HTTP`)) {
            continue;
          } else {
            throw error;
          }
        }
      }
      await this.cleanupTaskResources();

      return output;
    } catch (error) {
      CloudRunnerLogger.log('Running job failed');
      core.error(JSON.stringify(error, undefined, 4));
      await this.cleanupTaskResources();
      throw error;
    }
  }

  private async createSecret(secrets: CloudRunnerSecret[]) {
    await KubernetesSecret.createSecret(secrets, this.secretName, this.namespace, this.kubeClient);
    CloudRunnerLogger.log(`Secret created`);
  }

  private async createNamespacedJob(
    commands: string,
    image: string,
    mountdir: string,
    workingdir: string,
    environment: CloudRunnerEnvironmentVariable[],
    secrets: CloudRunnerSecret[],
  ) {
    const jobSpec = KubernetesJobSpecFactory.getJobSpec(
      commands,
      image,
      mountdir,
      workingdir,
      environment,
      secrets,
      this.buildGuid,
      this.buildParameters,
      this.secretName,
      this.pvcName,
      this.jobName,
      k8s,
    );
    await this.kubeClientBatch.createNamespacedJob(this.namespace, jobSpec);
    CloudRunnerLogger.log(`Build job created`);
    await new Promise((promise) => setTimeout(promise, 5000));
    CloudRunnerLogger.log('Job created');
  }

  setPodNameAndContainerName(pod: k8s.V1Pod) {
    this.podName = pod.metadata?.name || '';
    this.containerName = pod.status?.containerStatuses?.[0].name || '';
  }

  async cleanupTaskResources() {
    CloudRunnerLogger.log('cleaning up');
    try {
      await this.kubeClientBatch.deleteNamespacedJob(this.jobName, this.namespace);
      await this.kubeClient.deleteNamespacedPod(this.podName, this.namespace);
      await this.kubeClient.deleteNamespacedSecret(this.secretName, this.namespace);
      await new Promise((promise) => setTimeout(promise, 5000));
    } catch (error: any) {
      if (error.response.body.reason === `not found`) {
        return;
      }
      CloudRunnerLogger.log('Failed to cleanup, error:');
      core.error(JSON.stringify(error, undefined, 4));
      CloudRunnerLogger.log('Abandoning cleanup, build error:');
      throw error;
    }
    CloudRunnerLogger.log('cleaning up finished');
    try {
      await waitUntil(
        async () => {
          const jobBody = (await this.kubeClientBatch.readNamespacedJob(this.jobName, this.namespace)).body;
          const podBody = (await this.kubeClient.readNamespacedPod(this.podName, this.namespace)).body;

          return (jobBody === null || jobBody.status?.active === 0) && podBody === null;
        },
        {
          timeout: 500000,
          intervalBetweenAttempts: 15000,
        },
      );
      // eslint-disable-next-line no-empty
    } catch {}
  }

  async cleanupWorkflow(
    buildGuid: string,
    buildParameters: BuildParameters,
    // eslint-disable-next-line no-unused-vars
    branchName: string,
    // eslint-disable-next-line no-unused-vars
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {
    if (buildParameters.retainWorkspace) {
      return;
    }
    CloudRunnerLogger.log(`deleting PVC`);

    try {
      const promise = this.kubeClient.deleteNamespacedPersistentVolumeClaim(this.pvcName, this.namespace);
      // eslint-disable-next-line github/no-then
      promise.catch((error: any) => {
        if (error.response.body.reason === `not found`) {
          return;
        }
        CloudRunnerLogger.log(`Cleanup failed ${JSON.stringify(error, undefined, 4)}`);
      });
      await promise;
      // eslint-disable-next-line no-empty
    } catch {}
  }

  static async findPodFromJob(kubeClient: CoreV1Api, jobName: string, namespace: string) {
    const namespacedPods = await kubeClient.listNamespacedPod(namespace);
    const pod = namespacedPods.body.items.find((x) => x.metadata?.labels?.['job-name'] === jobName);
    if (pod === undefined) {
      throw new Error("pod with job-name label doesn't exist");
    }

    return pod;
  }
}
export default Kubernetes;
