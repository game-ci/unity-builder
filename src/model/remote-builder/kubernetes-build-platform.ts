import * as k8s from '@kubernetes/client-node';
import { BuildParameters } from '..';
import * as core from '@actions/core';
import { RemoteBuilderProviderInterface } from './remote-builder-provider-interface';
import RemoteBuilderSecret from './remote-builder-secret';
import KubernetesStorage from './kubernetes-storage';
import RemoteBuilderEnvironmentVariable from './remote-builder-environment-variable';
import KubernetesLogging from './kubernetes-logging';
import KubernetesSecret from './kubernetes-secret';
import KubernetesUtilities from './kubernetes-utils';
import waitUntil from 'async-wait-until';

class Kubernetes implements RemoteBuilderProviderInterface {
  private kubeConfig: k8s.KubeConfig;
  private kubeClient: k8s.CoreV1Api;
  private kubeClientBatch: k8s.BatchV1Api;
  private buildId: string = '';
  private buildParameters: BuildParameters;
  private pvcName: string = '';
  private secretName: string = '';
  private jobName: string = '';
  private namespace: string;
  private podName: string = '';
  private containerName: string = '';

  constructor(buildParameters: BuildParameters) {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    const k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api);
    core.info('Loaded default Kubernetes configuration for this environment');

    this.kubeConfig = kc;
    this.kubeClient = k8sApi;
    this.kubeClientBatch = k8sBatchApi;

    this.namespace = 'default';
    this.buildParameters = buildParameters;
  }
  public async setupSharedBuildResources(
    buildUid: string,
    buildParameters: BuildParameters,
    // eslint-disable-next-line no-unused-vars
    branchName: string,
    // eslint-disable-next-line no-unused-vars
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {
    const pvcName = `unity-builder-pvc-${buildUid}`;
    this.pvcName = pvcName;
    await KubernetesStorage.createPersistentVolumeClaim(buildParameters, this.pvcName, this.kubeClient, this.namespace);
  }

  async runBuildTask(
    buildId: string,
    image: string,
    commands: string[],
    mountdir: string,
    workingdir: string,
    environment: RemoteBuilderEnvironmentVariable[],
    secrets: RemoteBuilderSecret[],
  ): Promise<void> {
    try {
      // setup
      this.buildId = buildId;
      this.secretName = `build-credentials-${buildId}`;
      this.jobName = `unity-builder-job-${buildId}`;
      await KubernetesSecret.createSecret(secrets, this.secretName, this.namespace, this.kubeClient);
      const jobSpec = this.getJobSpec(commands, image, mountdir, workingdir, environment);

      //run
      core.info('Creating build job');
      await this.kubeClientBatch.createNamespacedJob(this.namespace, jobSpec);
      core.info('Job created');
      await KubernetesStorage.watchUntilPVCNotPending(this.kubeClient, this.pvcName, this.namespace);
      core.info('PVC Bound');
      this.setPodNameAndContainerName(
        await KubernetesUtilities.findPodFromJob(this.kubeClient, this.jobName, this.namespace),
      );
      core.info('Watching pod until running');
      await KubernetesUtilities.watchUntilPodRunning(this.kubeClient, this.podName, this.namespace);
      core.info('Pod running, streaming logs');
      await KubernetesLogging.streamLogs(
        this.kubeConfig,
        this.kubeClient,
        this.jobName,
        this.podName,
        this.containerName,
        this.namespace,
        core.info,
      );
      await this.cleanupTaskResources();
    } catch (error) {
      core.info('Running job failed');
      core.error(JSON.stringify(error, undefined, 4));
      await this.cleanupTaskResources();
      throw error;
    }
  }

  getJobSpec(
    command: string[],
    image: string,
    mountdir: string,
    workingDirectory: string,
    environment: RemoteBuilderEnvironmentVariable[],
  ) {
    environment.push(
      ...[
        {
          name: 'GITHUB_SHA',
          value: this.buildId,
        },
        {
          name: 'GITHUB_WORKSPACE',
          value: '/data/repo',
        },
        {
          name: 'PROJECT_PATH',
          value: this.buildParameters.projectPath,
        },
        {
          name: 'BUILD_PATH',
          value: this.buildParameters.buildPath,
        },
        {
          name: 'BUILD_FILE',
          value: this.buildParameters.buildFile,
        },
        {
          name: 'BUILD_NAME',
          value: this.buildParameters.buildName,
        },
        {
          name: 'BUILD_METHOD',
          value: this.buildParameters.buildMethod,
        },
        {
          name: 'CUSTOM_PARAMETERS',
          value: this.buildParameters.customParameters,
        },
        {
          name: 'CHOWN_FILES_TO',
          value: this.buildParameters.chownFilesTo,
        },
        {
          name: 'BUILD_TARGET',
          value: this.buildParameters.platform,
        },
        {
          name: 'ANDROID_VERSION_CODE',
          value: this.buildParameters.androidVersionCode.toString(),
        },
        {
          name: 'ANDROID_KEYSTORE_NAME',
          value: this.buildParameters.androidKeystoreName,
        },
        {
          name: 'ANDROID_KEYALIAS_NAME',
          value: this.buildParameters.androidKeyaliasName,
        },
      ],
    );
    const job = new k8s.V1Job();
    job.apiVersion = 'batch/v1';
    job.kind = 'Job';
    job.metadata = {
      name: this.jobName,
      labels: {
        app: 'unity-builder',
      },
    };
    job.spec = {
      backoffLimit: 1,
      template: {
        spec: {
          volumes: [
            {
              name: 'build-mount',
              persistentVolumeClaim: {
                claimName: this.pvcName,
              },
            },
            {
              name: 'credentials',
              secret: {
                secretName: this.secretName,
              },
            },
          ],
          containers: [
            {
              name: 'main',
              image,
              command: ['bash'],
              args: ['-c', ...command],

              workingDir: `/${workingDirectory}`,
              resources: {
                requests: {
                  memory: this.buildParameters.remoteBuildMemory,
                  cpu: this.buildParameters.remoteBuildCpu,
                },
              },
              env: environment,
              volumeMounts: [
                {
                  name: 'build-mount',
                  mountPath: `/${mountdir}`,
                },
                {
                  name: 'credentials',
                  mountPath: '/credentials',
                  readOnly: true,
                },
              ],
              lifecycle: {
                preStop: {
                  exec: {
                    command: [
                      'bin/bash',
                      '-c',
                      `cd /data/builder/action/steps;
                      chmod +x /return_license.sh;
                      /return_license.sh;`,
                    ],
                  },
                },
              },
            },
          ],
          restartPolicy: 'Never',
        },
      },
    };
    return job;
  }

  setPodNameAndContainerName(pod: k8s.V1Pod) {
    this.podName = pod.metadata?.name || '';
    this.containerName = pod.status?.containerStatuses?.[0].name || '';
  }

  async cleanupTaskResources() {
    core.info('cleaning up');
    try {
      await this.kubeClientBatch.deleteNamespacedJob(this.jobName, this.namespace);
      await this.kubeClient.deleteNamespacedSecret(this.secretName, this.namespace);
      await waitUntil(
        async () => (await this.kubeClientBatch.readNamespacedJob(this.jobName, this.namespace)).body === null,
        {
          timeout: 500000,
          intervalBetweenAttempts: 15000,
        },
      );
    } catch (error) {
      core.info('Failed to cleanup, error:');
      core.error(JSON.stringify(error, undefined, 4));
      core.info('Abandoning cleanup, build error:');
    }
  }

  async cleanupSharedBuildResources(
    // eslint-disable-next-line no-unused-vars
    buildUid: string,
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
