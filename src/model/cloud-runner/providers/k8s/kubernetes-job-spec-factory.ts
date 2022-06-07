import { V1EnvVar, V1EnvVarSource, V1SecretKeySelector } from '@kubernetes/client-node';
import BuildParameters from '../../../build-parameters.ts';
import { CloudRunnerBuildCommandProcessor } from '../../services/cloud-runner-build-command-process.ts';
import CloudRunnerEnvironmentVariable from '../../services/cloud-runner-environment-variable';
import CloudRunnerSecret from '../../services/cloud-runner-secret';
import CloudRunner from '../../cloud-runner';

class KubernetesJobSpecFactory {
  static getJobSpec(
    command: string,
    image: string,
    mountdir: string,
    workingDirectory: string,
    environment: CloudRunnerEnvironmentVariable[],
    secrets: CloudRunnerSecret[],
    buildGuid: string,
    buildParameters: BuildParameters,
    secretName,
    pvcName,
    jobName,
    k8s,
  ) {
    environment.push(
      ...[
        {
          name: 'GITHUB_SHA',
          value: buildGuid,
        },
        {
          name: 'GITHUB_WORKSPACE',
          value: '/data/repo',
        },
        {
          name: 'PROJECT_PATH',
          value: buildParameters.projectPath,
        },
        {
          name: 'BUILD_PATH',
          value: buildParameters.buildPath,
        },
        {
          name: 'BUILD_FILE',
          value: buildParameters.buildFile,
        },
        {
          name: 'BUILD_NAME',
          value: buildParameters.buildName,
        },
        {
          name: 'BUILD_METHOD',
          value: buildParameters.buildMethod,
        },
        {
          name: 'CUSTOM_PARAMETERS',
          value: buildParameters.customParameters,
        },
        {
          name: 'CHOWN_FILES_TO',
          value: buildParameters.chownFilesTo,
        },
        {
          name: 'BUILD_TARGET',
          value: buildParameters.targetPlatform,
        },
        {
          name: 'ANDROID_VERSION_CODE',
          value: buildParameters.androidVersionCode.toString(),
        },
        {
          name: 'ANDROID_KEYSTORE_NAME',
          value: buildParameters.androidKeystoreName,
        },
        {
          name: 'ANDROID_KEYALIAS_NAME',
          value: buildParameters.androidKeyaliasName,
        },
      ],
    );
    const job = new k8s.V1Job();
    job.apiVersion = 'batch/v1';
    job.kind = 'Job';
    job.metadata = {
      name: jobName,
      labels: {
        app: 'unity-builder',
        buildGuid,
      },
    };
    job.spec = {
      backoffLimit: 0,
      template: {
        spec: {
          volumes: [
            {
              name: 'build-mount',
              persistentVolumeClaim: {
                claimName: pvcName,
              },
            },
          ],
          containers: [
            {
              name: 'main',
              image,
              command: ['/bin/sh'],
              args: ['-c', CloudRunnerBuildCommandProcessor.ProcessCommands(command, CloudRunner.buildParameters)],

              workingDir: `${workingDirectory}`,
              resources: {
                requests: {
                  memory: buildParameters.cloudRunnerMemory || '750M',
                  cpu: buildParameters.cloudRunnerCpu || '1',
                },
              },
              env: [
                ...environment.map((x) => {
                  const environmentVariable = new V1EnvVar();
                  environmentVariable.name = x.name;
                  environmentVariable.value = x.value;

                  return environmentVariable;
                }),
                ...secrets.map((x) => {
                  const secret = new V1EnvVarSource();
                  secret.secretKeyRef = new V1SecretKeySelector();
                  secret.secretKeyRef.key = x.ParameterKey;
                  secret.secretKeyRef.name = secretName;
                  const environmentVariable = new V1EnvVar();
                  environmentVariable.name = x.EnvironmentVariable;
                  environmentVariable.valueFrom = secret;

                  return environmentVariable;
                }),
              ],
              volumeMounts: [
                {
                  name: 'build-mount',
                  mountPath: `/${mountdir}`,
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
}
export default KubernetesJobSpecFactory;
