import * as k8s from '@kubernetes/client-node';
import { BuildParameters } from '../../..';
import * as core from '@actions/core';
import { ProviderInterface } from '../provider-interface';
import CloudRunnerSecret from '../../services/cloud-runner-secret';
import KubernetesStorage from './kubernetes-storage';
import CloudRunnerEnvironmentVariable from '../../services/cloud-runner-environment-variable';
import KubernetesTaskRunner from './kubernetes-task-runner';
import KubernetesSecret from './kubernetes-secret';
import KubernetesJobSpecFactory from './kubernetes-job-spec-factory';
import KubernetesServiceAccount from './kubernetes-service-account';
import CloudRunnerLogger from '../../services/cloud-runner-logger';
import { CoreV1Api } from '@kubernetes/client-node';
import CloudRunner from '../../cloud-runner';
import { ProviderResource } from '../provider-resource';
import { ProviderWorkflow } from '../provider-workflow';

class Kubernetes implements ProviderInterface {
  private kubeConfig!: k8s.KubeConfig;
  private kubeClient!: k8s.CoreV1Api;
  private kubeClientBatch!: k8s.BatchV1Api;
  private buildGuid: string = '';
  private buildParameters!: BuildParameters;
  private pvcName: string = '';
  private secretName: string = '';
  private jobName: string = '';
  private namespace!: string;
  private podName: string = '';
  private containerName: string = '';
  private cleanupCronJobName: string = '';
  private serviceAccountName: string = '';

  // eslint-disable-next-line no-unused-vars
  constructor(buildParameters: BuildParameters) {
    this.kubeConfig = new k8s.KubeConfig();
    this.kubeConfig.loadFromDefault();
    this.kubeClient = this.kubeConfig.makeApiClient(k8s.CoreV1Api);
    this.kubeClientBatch = this.kubeConfig.makeApiClient(k8s.BatchV1Api);
    this.namespace = 'default';
    CloudRunnerLogger.log('Loaded default Kubernetes configuration for this environment');
  }

  async listResources(): Promise<ProviderResource[]> {
    const pods = await this.kubeClient.listNamespacedPod(this.namespace);
    const serviceAccounts = await this.kubeClient.listNamespacedServiceAccount(this.namespace);
    const secrets = await this.kubeClient.listNamespacedSecret(this.namespace);
    const jobs = await this.kubeClientBatch.listNamespacedJob(this.namespace);

    return [
      ...pods.body.items.map((x) => {
        return { Name: x.metadata?.name || `` };
      }),
      ...serviceAccounts.body.items.map((x) => {
        return { Name: x.metadata?.name || `` };
      }),
      ...secrets.body.items.map((x) => {
        return { Name: x.metadata?.name || `` };
      }),
      ...jobs.body.items.map((x) => {
        return { Name: x.metadata?.name || `` };
      }),
    ];
  }
  inspectResources(): Promise<ProviderResource> {
    throw new Error('Method not implemented.');
  }
  listWorkflow(): Promise<ProviderWorkflow[]> {
    throw new Error('Method not implemented.');
  }
  inspectWorkflow(): Promise<ProviderWorkflow> {
    throw new Error('Method not implemented.');
  }
  watchWorkflow(): Promise<string> {
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
    return new Promise((result) => result(``));
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
      this.buildParameters = buildParameters;
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
      CloudRunnerLogger.log('Cloud Runner K8s workflow!');

      // Setup
      this.buildGuid = buildGuid;
      this.secretName = `build-credentials-${this.buildGuid}`;
      this.jobName = `unity-builder-job-${this.buildGuid}`;
      this.containerName = `main`;
      const namespaceListTest = await this.kubeClient.listNamespace();
      CloudRunnerLogger.log(`Init test ${namespaceListTest.body.items.length}`);
      await KubernetesSecret.createSecret(secrets, this.secretName, this.namespace, this.kubeClient);
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
          CloudRunnerLogger.log('error running k8s workflow');
          CloudRunnerLogger.log(error.message);
          throw error;
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

  private async createNamespacedJob(
    commands: string,
    image: string,
    mountdir: string,
    workingdir: string,
    environment: CloudRunnerEnvironmentVariable[],
    secrets: CloudRunnerSecret[],
  ) {
    for (let index = 0; index < 3; index++) {
      try {
        CloudRunnerLogger.log(`Job spec creating`);
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
        CloudRunnerLogger.log(`Job spec created`);
        await new Promise((promise) => setTimeout(promise, 15000));
        await this.kubeClientBatch.createNamespacedJob(this.namespace, jobSpec);
        CloudRunnerLogger.log(`Build job created`);
        await new Promise((promise) => setTimeout(promise, 5000));
        CloudRunnerLogger.log('Job created');

        return;
      } catch (error) {
        CloudRunnerLogger.log(`Error occured creating job: ${error}`);
      }
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
      await new Promise((promise) => setTimeout(promise, 15000));
      CloudRunnerLogger.log('cleaned up Secret, Job and Pod');
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
