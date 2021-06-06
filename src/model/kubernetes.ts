import * as k8s from '@kubernetes/client-node';
import { BuildParameters } from '.';
import * as core from '@actions/core';
import { KubeConfig, Log } from '@kubernetes/client-node';
import { Writable } from 'stream';
import { RemoteBuilderProviderInterface } from './remote-builder/remote-builder-provider-interface';
import RemoteBuilderSecret from './remote-builder/remote-builder-secret';
const base64 = require('base-64');

const pollInterval = 20000;

class Kubernetes implements RemoteBuilderProviderInterface {
  private kubeConfig: KubeConfig;
  private kubeClient: k8s.CoreV1Api;
  private kubeClientBatch: k8s.BatchV1Api;
  private buildId: string;
  private buildParameters: BuildParameters;
  private baseImage: any;
  private pvcName: string;
  private secretName: string;
  private jobName: string;
  private podName: string | any;
  private containerName: string | any;
  private namespace: string;

  constructor(buildParameters: BuildParameters, baseImage) {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    const k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api);
    core.info('Loaded default Kubernetes configuration for this environment');

    const buildId = Kubernetes.uuidv4();
    const pvcName = `unity-builder-pvc-${buildId}`;
    const secretName = `build-credentials-${buildId}`;
    const jobName = `unity-builder-job-${buildId}`;
    const namespace = 'default';

    this.kubeConfig = kc;
    this.kubeClient = k8sApi;
    this.kubeClientBatch = k8sBatchApi;
    this.buildId = buildId;
    this.pvcName = pvcName;
    this.secretName = secretName;
    this.jobName = jobName;
    this.namespace = namespace;
    this.buildParameters = buildParameters;
    this.baseImage = baseImage;
  }

  async run() {
    core.info('Running Remote Builder on Kubernetes');
    const defaultSecretsArray = [
      {
        ParameterKey: 'GithubToken',
        EnvironmentVariable: 'GITHUB_TOKEN',
        ParameterValue: this.buildParameters.githubToken,
      },
    ];
    // setup
    await this.createSecret(defaultSecretsArray);
    await this.createPersistentVolumeClaim();

    // run
    await this.runCloneJob();
    await this.runBuildJob();

    core.setOutput('volume', this.pvcName);
  }

  async createSecret(secrets: RemoteBuilderSecret[]) {
    const secret = new k8s.V1Secret();
    secret.apiVersion = 'v1';
    secret.kind = 'Secret';
    secret.type = 'Opaque';
    secret.metadata = {
      name: this.secretName,
    };

    secret.data = {
      UNITY_LICENSE: base64.encode(process.env.UNITY_LICENSE),
      ANDROID_KEYSTORE_BASE64: base64.encode(this.buildParameters.androidKeystoreBase64),
      ANDROID_KEYSTORE_PASS: base64.encode(this.buildParameters.androidKeystorePass),
      ANDROID_KEYALIAS_PASS: base64.encode(this.buildParameters.androidKeyaliasPass),
    };

    for (const buildSecret of secrets) {
      secret.data[buildSecret.EnvironmentVariable] = base64.encode(buildSecret.ParameterValue);
      secret.data[`${buildSecret.EnvironmentVariable}_NAME`] = buildSecret.ParameterKey;
    }

    try {
      await this.kubeClient.createNamespacedSecret(this.namespace, secret);
    } catch (error) {
      throw error;
    }
  }

  async createPersistentVolumeClaim() {
    if (this.buildParameters.kubeVolume) {
      core.info(this.buildParameters.kubeVolume);
      this.pvcName = this.buildParameters.kubeVolume;
      return;
    }
    const pvc = new k8s.V1PersistentVolumeClaim();
    pvc.apiVersion = 'v1';
    pvc.kind = 'PersistentVolumeClaim';
    pvc.metadata = {
      name: this.pvcName,
    };
    pvc.spec = {
      accessModes: ['ReadWriteOnce'],
      volumeMode: 'Filesystem',
      resources: {
        requests: {
          storage: this.buildParameters.kubeVolumeSize,
        },
      },
    };
    await this.kubeClient.createNamespacedPersistentVolumeClaim(this.namespace, pvc);
    core.info('Persistent Volume created, waiting for ready state...');
  }

  async runJob(command: string[], image: string) {
    core.info('Creating build job');
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
      template: {
        spec: {
          volumes: [
            {
              name: 'data',
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
              command,
              resources: {
                requests: {
                  memory: this.buildParameters.remoteBuildMemory,
                  cpu: this.buildParameters.remoteBuildCpu,
                },
              },
              env: [
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
              volumeMounts: [
                {
                  name: 'data',
                  mountPath: '/data',
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
    job.spec.backoffLimit = 1;
    await this.kubeClientBatch.createNamespacedJob(this.namespace, job);
    core.info('Job created');

    try {
      // We watch the PVC first to allow some time for K8s to notice the job we created and setup a pod.
      await this.watchPersistentVolumeClaimUntilReady();

      // TODO: Wait for something more reliable so we don't potentially get the pod before k8s has created it based on the job.
      this.setPodNameAndContainerName(await this.getPod());

      await this.watchUntilPodRunning();
      await this.streamLogs();
    } catch (error) {
      core.error(JSON.stringify(error, undefined, 4));
    } finally {
      await this.cleanup();
    }
  }

  async getPod() {
    if (this.podName === undefined) {
      const pod = (await this.kubeClient.listNamespacedPod(this.namespace)).body.items.find(
        (x) => x.metadata?.labels?.['job-name'] === this.jobName,
      );
      return pod;
    } else {
      return (await this.kubeClient.readNamespacedPod(this.podName, this.namespace)).body;
    }
  }

  async runCloneJob() {
    await this.runJob(
      [
        '/bin/ash',
        '-c',
        `apk update;
    apk add git-lfs;
    ls /credentials/
    export GITHUB_TOKEN=$(cat /credentials/GITHUB_TOKEN);
    cd /data;
    git clone https://github.com/${process.env.GITHUB_REPOSITORY}.git repo;
    git clone https://github.com/webbertakken/unity-builder.git builder;
    cd repo;
    git checkout $GITHUB_SHA;
    ls
    echo "end"`,
      ],
      'alpine/git',
    );
  }

  async runBuildJob() {
    await this.runJob(
      [
        'bin/bash',
        '-c',
        `ls
    for f in ./credentials/*; do export $(basename $f)="$(cat $f)"; done
    ls /data
    ls /data/builder
    ls /data/builder/dist
    cp -r /data/builder/dist/default-build-script /UnityBuilderAction
    cp -r /data/builder/dist/entrypoint.sh /entrypoint.sh
    cp -r /data/builder/dist/steps /steps
    chmod -R +x /entrypoint.sh
    chmod -R +x /steps
    /entrypoint.sh
    `,
      ],
      this.baseImage.toString(),
    );
  }

  async watchPersistentVolumeClaimUntilReady() {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
    const queryResult = await this.kubeClient.readNamespacedPersistentVolumeClaim(this.pvcName, this.namespace);

    if (queryResult.body.status?.phase === 'Pending') {
      await this.watchPersistentVolumeClaimUntilReady();
    } else {
      core.info('Persistent Volume ready for claims');
    }
  }

  async watchUntilPodRunning() {
    let ready = false;

    while (!ready) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      const pod = (await this.kubeClient.readNamespacedPod(this.podName, this.namespace))?.body;
      if (pod === undefined) {
        throw new Error('no pod found');
      }
      const phase = pod.status?.phase;
      if (phase === 'Running') {
        core.info('Pod no longer pending');
        ready = true;
        return;
      }
      if (phase !== 'Pending') {
        core.error('Kubernetes job failed');
      }
    }
  }

  setPodNameAndContainerName(pod: k8s.V1Pod | any) {
    this.podName = pod?.metadata?.name || '';
    this.containerName = pod?.status?.containerStatuses?.[0].name || '';
  }

  async streamLogs() {
    try {
      core.info(
        `Streaming logs from pod: ${this.podName} container: ${this.containerName} namespace: ${this.namespace}`,
      );
      const stream = new Writable();
      stream._write = (chunk, encoding, next) => {
        core.info(chunk.toString());
        next();
      };
      await new Promise((resolve) =>
        new Log(this.kubeConfig).log(this.namespace, this.podName, this.containerName, stream, resolve, {
          follow: true,
          pretty: true,
          previous: true,
        }),
      );
      core.info('end of log stream');
    } catch (error) {
      core.error(JSON.stringify(error, undefined, 4));
      throw error;
    }
  }

  async cleanup() {
    core.info('cleaning up');
    await this.kubeClientBatch.deleteNamespacedJob(this.jobName, this.namespace);
    await this.kubeClient.deleteNamespacedPersistentVolumeClaim(this.pvcName, this.namespace);
    await this.kubeClient.deleteNamespacedSecret(this.secretName, this.namespace);
  }

  static uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.trunc(Math.random() * 16);
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
export default Kubernetes;
