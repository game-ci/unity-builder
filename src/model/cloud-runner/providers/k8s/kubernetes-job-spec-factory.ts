import { V1EnvVar, V1EnvVarSource, V1SecretKeySelector } from '@kubernetes/client-node';
import BuildParameters from '../../../build-parameters';
import { CommandHookService } from '../../services/hooks/command-hook-service';
import CloudRunnerEnvironmentVariable from '../../options/cloud-runner-environment-variable';
import CloudRunnerSecret from '../../options/cloud-runner-secret';
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
    secretName: string,
    pvcName: string,
    jobName: string,
    k8s: any,
    containerName: string,
    ip: string = '',
  ) {
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
      ttlSecondsAfterFinished: 9999,
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
              ttlSecondsAfterFinished: 9999,
              name: containerName,
              image,
              command: ['/bin/sh'],
              args: [
                '-c',
                `${CommandHookService.ApplyHooksToCommands(`${command}\nsleep 2m`, CloudRunner.buildParameters)}`,
              ],

              workingDir: `${workingDirectory}`,
              resources: {
                requests: {
                  memory: `${Number.parseInt(buildParameters.containerMemory) / 1024}G` || '750M',
                  cpu: Number.parseInt(buildParameters.containerCpu) / 1024 || '1',
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
                { name: 'LOG_SERVICE_IP', value: ip },
              ],
              volumeMounts: [
                {
                  name: 'build-mount',
                  mountPath: `${mountdir}`,
                },
              ],
              lifecycle: {
                preStop: {
                  exec: {
                    command: [
                      `wait 60s;
                      cd /data/builder/action/steps;
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

    if (process.env['CLOUD_RUNNER_MINIKUBE']) {
      job.spec.template.spec.volumes[0] = {
        name: 'build-mount',
        hostPath: {
          path: `/data`,
          type: `Directory`,
        },
      };
    }

    job.spec.template.spec.containers[0].resources.requests[`ephemeral-storage`] = '10Gi';

    return job;
  }
}
export default KubernetesJobSpecFactory;
