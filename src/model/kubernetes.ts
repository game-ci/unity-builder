// @ts-ignore
import { Client, KubeConfig } from 'kubernetes-client';
import Request from 'kubernetes-client/backends/request';

const core = require('@actions/core');
const base64 = require('base-64');

const pollInterval = 10000;

class Kubernetes {
  private static kubeClient: any;
  private static buildId: string;
  private static buildParameters: any;
  private static baseImage: any;
  private static pvcName: string;
  private static secretName: string;
  private static jobName: string;
  private static namespace: string;

  static async runBuildJob(buildParameters, baseImage) {
    const kubeconfig = new KubeConfig();
    kubeconfig.loadFromString(base64.decode(buildParameters.kubeConfig));
    const backend = new Request({ kubeconfig });
    const kubeClient = new Client(backend);
    await kubeClient.loadSpec();

    const buildId = Kubernetes.uuidv4();
    const pvcName = `unity-builder-pvc-${buildId}`;
    const secretName = `build-credentials-${buildId}`;
    const jobName = `unity-builder-job-${buildId}`;
    const namespace = 'default';

    this.kubeClient = kubeClient;
    this.buildId = buildId;
    this.buildParameters = buildParameters;
    this.baseImage = baseImage;
    this.pvcName = pvcName;
    this.secretName = secretName;
    this.jobName = jobName;
    this.namespace = namespace;

    await Kubernetes.createSecret();
    await Kubernetes.createPersistentVolumeClaim();
    await Kubernetes.scheduleBuildJob();
    await Kubernetes.watchBuildJobUntilFinished();
    await Kubernetes.cleanup();

    core.setOutput('volume', pvcName);
  }

  static async createSecret() {
    const secretManifest = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: this.secretName,
      },
      type: 'Opaque',
      data: {
        GITHUB_TOKEN: base64.encode(this.buildParameters.githubToken),
        UNITY_LICENSE: base64.encode(process.env.UNITY_LICENSE),
        ANDROID_KEYSTORE_BASE64: base64.encode(this.buildParameters.androidKeystoreBase64),
        ANDROID_KEYSTORE_PASS: base64.encode(this.buildParameters.androidKeystorePass),
        ANDROID_KEYALIAS_PASS: base64.encode(this.buildParameters.androidKeyaliasPass),
      },
    };
    await this.kubeClient.api.v1.namespaces(this.namespace).secrets.post({ body: secretManifest });
  }

  static async createPersistentVolumeClaim() {
    if (this.buildParameters.kubeVolume) {
      core.info(this.buildParameters.kubeVolume);
      this.pvcName = this.buildParameters.kubeVolume;
      return;
    }
    const pvcManifest = {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: {
        name: this.pvcName,
      },
      spec: {
        accessModes: ['ReadWriteOnce'],
        volumeMode: 'Filesystem',
        resources: {
          requests: {
            storage: this.buildParameters.kubeVolumeSize,
          },
        },
      },
    };
    await this.kubeClient.api.v1.namespaces(this.namespace).persistentvolumeclaims.post({ body: pvcManifest });
    core.info('Persistent Volume created, waiting for ready state...');
    await Kubernetes.watchPersistentVolumeClaimUntilReady();
    core.info('Persistent Volume ready for claims');
  }

  static async watchPersistentVolumeClaimUntilReady() {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
    const queryResult = await this.kubeClient.api.v1
      .namespaces(this.namespace)
      .persistentvolumeclaims(this.pvcName)
      .get();
    if (queryResult.body.status.phase === 'Pending') {
      await Kubernetes.watchPersistentVolumeClaimUntilReady();
    }
  }

  static async scheduleBuildJob() {
    core.info('Creating build job');
    const jobManifest = {
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: {
        name: this.jobName,
        labels: {
          app: 'unity-builder',
        },
      },
      spec: {
        template: {
          backoffLimit: 1,
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
            initContainers: [
              {
                name: 'clone',
                image: 'alpine/git',
                command: [
                  '/bin/sh',
                  '-c',
                  `apk update;
                  apk add git-lfs;
                  export GITHUB_TOKEN=$(cat /credentials/GITHUB_TOKEN);
                  cd /data;
                  git clone https://github.com/${process.env.GITHUB_REPOSITORY}.git repo;
                  git clone https://github.com/webbertakken/unity-builder.git builder;
                  cd repo;
                  git checkout $GITHUB_SHA;
                  ls`,
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
                env: [
                  {
                    name: 'GITHUB_SHA',
                    value: this.buildId,
                  },
                ],
              },
            ],
            containers: [
              {
                name: 'main',
                image: `${this.baseImage.toString()}`,
                command: [
                  'bin/bash',
                  '-c',
                  `for f in ./credentials/*; do export $(basename $f)="$(cat $f)"; done
                  cp -r /data/builder/action/default-build-script /UnityBuilderAction
                  cp -r /data/builder/action/entrypoint.sh /entrypoint.sh
                  cp -r /data/builder/action/steps /steps
                  chmod -R +x /entrypoint.sh;
                  chmod -R +x /steps;
                  /entrypoint.sh;
                  `,
                ],
                resources: {
                  requests: {
                    memory: this.buildParameters.kubeContainerMemory,
                    cpu: this.buildParameters.kubeContainerCPU,
                  },
                },
                env: [
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
                lifeCycle: {
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
      },
    };
    await this.kubeClient.apis.batch.v1.namespaces(this.namespace).jobs.post({ body: jobManifest });
    core.info('Job created');
  }

  static async watchBuildJobUntilFinished() {
    let podname;
    let ready = false;
    while (!ready) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      const pods = await this.kubeClient.api.v1.namespaces(this.namespace).pods.get();
      for (let index = 0; index < pods.body.items.length; index++) {
        const element = pods.body.items[index];
        if (element.metadata.labels['job-name'] === this.jobName && element.status.phase !== 'Pending') {
          core.info('Pod no longer pending');
          if (element.status.phase === 'Failure') {
            core.error('Kubernetes job failed');
          } else {
            ready = true;
            podname = element.metadata.name;
          }
        }
      }
    }

    core.info(`Watching build job ${podname}`);
    let logQueryTime;
    let complete = false;
    while (!complete) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const podStatus = await this.kubeClient.api.v1.namespaces(this.namespace).pod(podname).get();
      if (podStatus.body.status.phase !== 'Running') {
        complete = true;
      }

      const logs = await this.kubeClient.api.v1
        .namespaces(this.namespace)
        .pod(podname)
        .log.get({
          qs: {
            sinceTime: logQueryTime,
            timestamps: true,
          },
        });
      if (logs.body !== undefined) {
        const arrayOfLines = logs.body.match(/[^\n\r]+/g).reverse();
        for (const element of arrayOfLines) {
          const [time, ...line] = element.split(' ');
          if (time !== logQueryTime) {
            core.info(line.join(' '));
          } else {
            break;
          }
        }

        if (podStatus.body.status.phase === 'Failed') {
          throw new Error('Kubernetes job failed');
        }

        logQueryTime = arrayOfLines[0].split(' ')[0];
      }
    }
  }

  static async cleanup() {
    await this.kubeClient.apis.batch.v1.namespaces(this.namespace).jobs(this.jobName).delete();
    await this.kubeClient.api.v1.namespaces(this.namespace).secrets(this.secretName).delete();
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
