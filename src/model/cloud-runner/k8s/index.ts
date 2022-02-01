import * as k8s from '@kubernetes/client-node';
import { BuildParameters, Output } from '../..';
import * as core from '@actions/core';
import { CloudRunnerProviderInterface } from '../services/cloud-runner-provider-interface';
import CloudRunnerSecret from '../services/cloud-runner-secret';
import KubernetesStorage from './kubernetes-storage';
import CloudRunnerEnvironmentVariable from '../services/cloud-runner-environment-variable';
import KubernetesTaskRunner from './kubernetes-task-runner';
import KubernetesSecret from './kubernetes-secret';
import waitUntil from 'async-wait-until';
import KubernetesJobSpecFactory from './kubernetes-job-spec-factory';
import KubernetesServiceAccount from './kubernetes-service-account';
import CloudRunnerLogger from '../services/cloud-runner-logger';
import { CoreV1Api } from '@kubernetes/client-node';

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

  constructor(buildParameters: BuildParameters) {
    this.kubeConfig = new k8s.KubeConfig();
    this.kubeConfig.loadFromDefault();
    this.kubeClient = this.kubeConfig.makeApiClient(k8s.CoreV1Api);
    this.kubeClientBatch = this.kubeConfig.makeApiClient(k8s.BatchV1Api);
    CloudRunnerLogger.log('Loaded default Kubernetes configuration for this environment');

    this.namespace = 'default';
    this.buildParameters = buildParameters;
  }
  public async setupSharedResources(
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

  async runTask(
    buildGuid: string,
    image: string,
    commands: string,
    mountdir: string,
    workingdir: string,
    environment: CloudRunnerEnvironmentVariable[],
    secrets: CloudRunnerSecret[],
  ): Promise<string> {
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
        secrets,
        this.buildGuid,
        this.buildParameters,
        this.secretName,
        this.pvcName,
        this.jobName,
        k8s,
      );

      //run
      const jobResult = await this.kubeClientBatch.createNamespacedJob(this.namespace, jobSpec);
      CloudRunnerLogger.log(`Creating build job ${JSON.stringify(jobResult.body.metadata, undefined, 4)}`);

      await new Promise((promise) => setTimeout(promise, 5000));
      CloudRunnerLogger.log('Job created');
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
            CloudRunnerLogger.log,
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
    } catch (error) {
      CloudRunnerLogger.log('Failed to cleanup, error:');
      core.error(JSON.stringify(error, undefined, 4));
      CloudRunnerLogger.log('Abandoning cleanup, build error:');
      throw error;
    }
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

  async cleanupSharedResources(
    buildGuid: string,
    buildParameters: BuildParameters,
    // eslint-disable-next-line no-unused-vars
    branchName: string,
    // eslint-disable-next-line no-unused-vars
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {
    CloudRunnerLogger.log(`deleting PVC`);
    await this.kubeClient.deleteNamespacedPersistentVolumeClaim(this.pvcName, this.namespace);
    await Output.setBuildVersion(buildParameters.buildVersion);
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit();
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
