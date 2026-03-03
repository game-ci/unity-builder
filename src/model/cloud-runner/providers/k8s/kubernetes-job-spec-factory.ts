import { V1EnvVar, V1EnvVarSource, V1SecretKeySelector } from '@kubernetes/client-node';
import BuildParameters from '../../../build-parameters';
import { CommandHookService } from '../../services/hooks/command-hook-service';
import CloudRunnerEnvironmentVariable from '../../options/cloud-runner-environment-variable';
import CloudRunnerSecret from '../../options/cloud-runner-secret';
import CloudRunner from '../../cloud-runner';
import CloudRunnerLogger from '../../services/core/cloud-runner-logger';

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
    const endpointEnvironmentNames = new Set([
      'AWS_S3_ENDPOINT',
      'AWS_ENDPOINT',
      'AWS_CLOUD_FORMATION_ENDPOINT',
      'AWS_ECS_ENDPOINT',
      'AWS_KINESIS_ENDPOINT',
      'AWS_CLOUD_WATCH_LOGS_ENDPOINT',
      'INPUT_AWSS3ENDPOINT',
      'INPUT_AWSENDPOINT',
    ]);

    // Determine the LocalStack hostname to use for K8s pods
    // Priority: K8S_LOCALSTACK_HOST env var > localstack-main (container name on shared network)
    // Note: Using K8S_LOCALSTACK_HOST instead of LOCALSTACK_HOST to avoid conflict with awslocal CLI
    const localstackHost = process.env['K8S_LOCALSTACK_HOST'] || 'localstack-main';
    CloudRunnerLogger.log(`K8s pods will use LocalStack host: ${localstackHost}`);

    const adjustedEnvironment = environment.map((x) => {
      let value = x.value;
      if (
        typeof value === 'string' &&
        endpointEnvironmentNames.has(x.name) &&
        (value.startsWith('http://localhost') || value.startsWith('http://127.0.0.1'))
      ) {
        // Replace localhost with the LocalStack container hostname
        // When k3d and LocalStack are on the same Docker network, pods can reach LocalStack by container name
        value = value
          .replace('http://localhost', `http://${localstackHost}`)
          .replace('http://127.0.0.1', `http://${localstackHost}`);
        CloudRunnerLogger.log(`Replaced localhost with ${localstackHost} for ${x.name}: ${value}`);
      }

      return { name: x.name, value } as CloudRunnerEnvironmentVariable;
    });

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

    // Reduce TTL for tests to free up resources faster (default 9999s = ~2.8 hours)
    // For CI/test environments, use shorter TTL (300s = 5 minutes) to prevent disk pressure
    const jobTTL = process.env['cloudRunnerTests'] === 'true' ? 300 : 9999;
    job.spec = {
      ttlSecondsAfterFinished: jobTTL,
      backoffLimit: 0,
      template: {
        spec: {
          terminationGracePeriodSeconds: 90, // Give PreStopHook (60s sleep) time to complete
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
              imagePullPolicy: process.env['cloudRunnerTests'] === 'true' ? 'IfNotPresent' : 'Always',
              command: ['/bin/sh'],
              args: [
                '-c',
                `${CommandHookService.ApplyHooksToCommands(`${command}\nsleep 2m`, CloudRunner.buildParameters)}`,
              ],

              workingDir: `${workingDirectory}`,
              resources: {
                requests: (() => {
                  // Use smaller resource requests for lightweight hook containers
                  // Hook containers typically use utility images like aws-cli, rclone, etc.
                  const lightweightImages = ['amazon/aws-cli', 'rclone/rclone', 'steamcmd/steamcmd', 'ubuntu'];
                  const isLightweightContainer = lightweightImages.some((lightImage) => image.includes(lightImage));

                  if (isLightweightContainer && process.env['cloudRunnerTests'] === 'true') {
                    // For test environments, use minimal resources for hook containers
                    return {
                      memory: '128Mi',
                      cpu: '100m', // 0.1 CPU
                    };
                  }

                  // For main build containers, use the configured resources
                  const memoryMB = Number.parseInt(buildParameters.containerMemory);
                  const cpuMB = Number.parseInt(buildParameters.containerCpu);

                  return {
                    memory: !Number.isNaN(memoryMB) && memoryMB > 0 ? `${memoryMB / 1024}G` : '750M',
                    cpu: !Number.isNaN(cpuMB) && cpuMB > 0 ? `${cpuMB / 1024}` : '1',
                  };
                })(),
              },
              env: [
                ...adjustedEnvironment.map((x) => {
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
                      '/bin/sh',
                      '-c',
                      'sleep 60; cd /data/builder/action/steps && chmod +x /steps/return_license.sh 2>/dev/null || true; /steps/return_license.sh 2>/dev/null || true',
                    ],
                  },
                },
              },
            },
          ],
          restartPolicy: 'Never',

          // Add tolerations for CI/test environments to allow scheduling even with disk pressure
          // This is acceptable for CI where we aggressively clean up disk space
          tolerations: [
            {
              key: 'node.kubernetes.io/disk-pressure',
              operator: 'Exists',
              effect: 'NoSchedule',
            },
          ],
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

    // Set ephemeral-storage request to a reasonable value to prevent evictions
    // For tests, don't set a request (or use minimal 128Mi) since k3d nodes have very limited disk space
    // Kubernetes will use whatever is available without a request, which is better for constrained environments
    // For production, use 2Gi to allow for larger builds
    // The node needs some free space headroom, so requesting too much causes evictions
    // With node at 96% usage and only ~2.7GB free, we can't request much without triggering evictions
    if (process.env['cloudRunnerTests'] !== 'true') {
      // Only set ephemeral-storage request for production builds
      job.spec.template.spec.containers[0].resources.requests[`ephemeral-storage`] = '2Gi';
    }

    // For tests, don't set ephemeral-storage request - let Kubernetes use available space

    return job;
  }
}
export default KubernetesJobSpecFactory;
