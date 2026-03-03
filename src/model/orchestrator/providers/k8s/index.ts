import * as k8s from '@kubernetes/client-node';
import { BuildParameters } from '../../..';
import * as core from '@actions/core';
import { ProviderInterface } from '../provider-interface';
import OrchestratorSecret from '../../options/orchestrator-secret';
import KubernetesStorage from './kubernetes-storage';
import OrchestratorEnvironmentVariable from '../../options/orchestrator-environment-variable';
import KubernetesTaskRunner from './kubernetes-task-runner';
import KubernetesSecret from './kubernetes-secret';
import KubernetesJobSpecFactory from './kubernetes-job-spec-factory';
import KubernetesServiceAccount from './kubernetes-service-account';
import OrchestratorLogger from '../../services/core/orchestrator-logger';
import { CoreV1Api } from '@kubernetes/client-node';
import Orchestrator from '../../orchestrator';
import { ProviderResource } from '../provider-resource';
import { ProviderWorkflow } from '../provider-workflow';
import { RemoteClientLogger } from '../../remote-client/remote-client-logger';
import { KubernetesRole } from './kubernetes-role';
import { OrchestratorSystem } from '../../services/core/orchestrator-system';
import ResourceTracking from '../../services/core/resource-tracking';

class Kubernetes implements ProviderInterface {
  public static Instance: Kubernetes;
  public kubeConfig!: k8s.KubeConfig;
  public kubeClient!: k8s.CoreV1Api;
  public kubeClientApps!: k8s.AppsV1Api;
  public kubeClientBatch!: k8s.BatchV1Api;
  public rbacAuthorizationV1Api!: k8s.RbacAuthorizationV1Api;
  public buildGuid: string = '';
  public buildParameters!: BuildParameters;
  public pvcName: string = '';
  public secretName: string = '';
  public jobName: string = '';
  public namespace!: string;
  public podName: string = '';
  public containerName: string = '';
  public cleanupCronJobName: string = '';
  public serviceAccountName: string = '';
  public ip: string = '';

  constructor(buildParameters: BuildParameters) {
    Kubernetes.Instance = this;
    this.kubeConfig = new k8s.KubeConfig();
    this.kubeConfig.loadFromDefault();
    this.kubeClient = this.kubeConfig.makeApiClient(k8s.CoreV1Api);
    this.kubeClientApps = this.kubeConfig.makeApiClient(k8s.AppsV1Api);
    this.kubeClientBatch = this.kubeConfig.makeApiClient(k8s.BatchV1Api);
    this.rbacAuthorizationV1Api = this.kubeConfig.makeApiClient(k8s.RbacAuthorizationV1Api);
    this.namespace = buildParameters.containerNamespace ? buildParameters.containerNamespace : 'default';
    OrchestratorLogger.log('Loaded default Kubernetes configuration for this environment');
  }

  async PushLogUpdate(logs: string) {
    // push logs to nginx file server via 'LOG_SERVICE_IP' env var
    const ip = process.env[`LOG_SERVICE_IP`];
    if (ip === undefined) {
      RemoteClientLogger.logWarning(`LOG_SERVICE_IP not set, skipping log push`);

      return;
    }
    const url = `http://${ip}/api/log`;
    RemoteClientLogger.log(`Pushing logs to ${url}`);

    // logs to base64
    logs = Buffer.from(logs).toString('base64');
    const response = await OrchestratorSystem.Run(`curl -X POST -d "${logs}" ${url}`, false, true);
    RemoteClientLogger.log(`Pushed logs to ${url} ${response}`);
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
  listWorkflow(): Promise<ProviderWorkflow[]> {
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
      this.cleanupCronJobName = `unity-builder-cronjob-${buildParameters.buildGuid}`;
      this.serviceAccountName = `service-account-${buildParameters.buildGuid}`;

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
    environment: OrchestratorEnvironmentVariable[],
    secrets: OrchestratorSecret[],
  ): Promise<string> {
    try {
      OrchestratorLogger.log('Orchestrator K8s workflow!');
      ResourceTracking.logAllocationSummary('k8s workflow');
      await ResourceTracking.logDiskUsageSnapshot('k8s workflow (host)');
      await ResourceTracking.logK3dNodeDiskUsage('k8s workflow (before job)');

      // Setup
      const id =
        BuildParameters && BuildParameters.shouldUseRetainedWorkspaceMode(this.buildParameters)
          ? Orchestrator.lockedWorkspace
          : this.buildParameters.buildGuid;
      this.pvcName = `unity-builder-pvc-${id}`;
      await KubernetesStorage.createPersistentVolumeClaim(
        this.buildParameters,
        this.pvcName,
        this.kubeClient,
        this.namespace,
      );
      this.buildGuid = buildGuid;
      this.secretName = `build-credentials-${this.buildGuid}`;
      this.jobName = `unity-builder-job-${this.buildGuid}`;
      this.containerName = `main`;
      await KubernetesSecret.createSecret(secrets, this.secretName, this.namespace, this.kubeClient);

      // For tests, clean up old images before creating job to free space for image pull
      // IMPORTANT: Preserve the Unity image to avoid re-pulling it
      if (process.env['orchestratorTests'] === 'true') {
        try {
          OrchestratorLogger.log('Cleaning up old images in k3d node before pulling new image...');
          const { OrchestratorSystem: OrchestratorSystemModule } = await import(
            '../../services/core/orchestrator-system'
          );

          // Aggressive cleanup: remove stopped containers and non-Unity images
          // IMPORTANT: Preserve Unity images (unityci/editor) to avoid re-pulling the 3.9GB image
          const K3D_NODE_CONTAINERS = ['k3d-unity-builder-agent-0', 'k3d-unity-builder-server-0'];
          const cleanupCommands: string[] = [];

          for (const NODE of K3D_NODE_CONTAINERS) {
            // Remove all stopped containers (this frees runtime space but keeps images)
            cleanupCommands.push(
              `docker exec ${NODE} sh -c "crictl rm --all 2>/dev/null || true" || true`,
              `docker exec ${NODE} sh -c "for img in $(crictl images -q 2>/dev/null); do repo=$(crictl inspecti $img --format '{{.repo}}' 2>/dev/null || echo ''); if echo "$repo" | grep -qvE 'unityci/editor|unity'; then crictl rmi $img 2>/dev/null || true; fi; done" || true`,
              `docker exec ${NODE} sh -c "crictl rmi --prune 2>/dev/null || true" || true`,
            );
          }

          for (const cmd of cleanupCommands) {
            try {
              await OrchestratorSystemModule.Run(cmd, true, true);
            } catch (cmdError) {
              // Ignore individual command failures - cleanup is best effort
              OrchestratorLogger.log(`Cleanup command failed (non-fatal): ${cmdError}`);
            }
          }
          OrchestratorLogger.log('Cleanup completed (containers and non-Unity images removed, Unity images preserved)');
        } catch (cleanupError) {
          OrchestratorLogger.logWarning(`Failed to cleanup images before job creation: ${cleanupError}`);

          // Continue anyway - image might already be cached
        }
      }

      let output = '';
      try {
        // Before creating the job, verify we have the Unity image cached on the agent node
        // If not cached, try to ensure it's available to avoid disk pressure during pull
        if (process.env['orchestratorTests'] === 'true' && image.includes('unityci/editor')) {
          try {
            const { OrchestratorSystem: OrchestratorSystemModule2 } = await import(
              '../../services/core/orchestrator-system'
            );

            // Check if image is cached on agent node (where pods run)
            const agentImageCheck = await OrchestratorSystemModule2.Run(
              `docker exec k3d-unity-builder-agent-0 sh -c "crictl images | grep -q unityci/editor && echo 'cached' || echo 'not_cached'" || echo 'not_cached'`,
              true,
              true,
            );

            if (agentImageCheck.includes('not_cached')) {
              // Check if image is on server node
              const serverImageCheck = await OrchestratorSystemModule2.Run(
                `docker exec k3d-unity-builder-server-0 sh -c "crictl images | grep -q unityci/editor && echo 'cached' || echo 'not_cached'" || echo 'not_cached'`,
                true,
                true,
              );

              // Check available disk space on agent node
              const diskInfo = await OrchestratorSystemModule2.Run(
                'docker exec k3d-unity-builder-agent-0 sh -c "df -h /var/lib/rancher/k3s 2>/dev/null | tail -1 || df -h / 2>/dev/null | tail -1 || echo unknown" || echo unknown',
                true,
                true,
              );

              OrchestratorLogger.logWarning(
                `Unity image not cached on agent node (where pods run). Server node: ${
                  serverImageCheck.includes('cached') ? 'has image' : 'no image'
                }. Disk info: ${diskInfo.trim()}. Pod will attempt to pull image (3.9GB) which may fail due to disk pressure.`,
              );

              // If image is on server but not agent, log a warning
              // NOTE: We don't attempt to pull here because:
              // 1. Pulling a 3.9GB image can take several minutes and block the test
              // 2. If there's not enough disk space, the pull will hang indefinitely
              // 3. The pod will attempt to pull during scheduling anyway
              // 4. If the pull fails, Kubernetes will provide proper error messages
              if (serverImageCheck.includes('cached')) {
                OrchestratorLogger.logWarning(
                  'Unity image exists on server node but not agent node. Pod will attempt to pull during scheduling. If pull fails due to disk pressure, ensure cleanup runs before this test.',
                );
              } else {
                // Image not on either node - check if we have enough space to pull
                // Extract available space from disk info
                const availableSpaceMatch = diskInfo.match(/(\d+(?:\.\d+)?)\s*([gkm]?i?b)/i);
                if (availableSpaceMatch) {
                  const availableValue = Number.parseFloat(availableSpaceMatch[1]);
                  const availableUnit = availableSpaceMatch[2].toUpperCase();
                  let availableGB = availableValue;

                  if (availableUnit.includes('M')) {
                    availableGB = availableValue / 1024;
                  } else if (availableUnit.includes('K')) {
                    availableGB = availableValue / (1024 * 1024);
                  }

                  // Unity image is ~3.9GB, need at least 4.5GB to be safe
                  if (availableGB < 4.5) {
                    OrchestratorLogger.logWarning(
                      `CRITICAL: Unity image not cached and only ${availableGB.toFixed(
                        2,
                      )}GB available. Image pull (3.9GB) will likely fail. Consider running cleanup or ensuring pre-pull step succeeds.`,
                    );
                  }
                }
              }
            } else {
              OrchestratorLogger.log('Unity image is cached on agent node - pod should start without pulling');
            }
          } catch (checkError) {
            // Ignore check errors - continue with job creation
            OrchestratorLogger.logWarning(`Failed to verify Unity image cache: ${checkError}`);
          }
        }

        OrchestratorLogger.log('Job does not exist');
        await this.createJob(commands, image, mountdir, workingdir, environment, secrets);
        OrchestratorLogger.log('Watching pod until running');
        await KubernetesTaskRunner.watchUntilPodRunning(this.kubeClient, this.podName, this.namespace);

        OrchestratorLogger.log('Pod is running');
        output += await KubernetesTaskRunner.runTask(
          this.kubeConfig,
          this.kubeClient,
          this.jobName,
          this.podName,
          this.containerName,
          this.namespace,
        );
      } catch (error: any) {
        OrchestratorLogger.log(`error running k8s workflow ${error}`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
        OrchestratorLogger.log(
          JSON.stringify(
            (await this.kubeClient.listNamespacedEvent(this.namespace)).body.items
              .map((x) => {
                return {
                  message: x.message || ``,
                  name: x.metadata.name || ``,
                  reason: x.reason || ``,
                };
              })
              .filter((x) => x.name.includes(this.podName)),
            undefined,
            4,
          ),
        );
        await this.cleanupTaskResources();
        throw error;
      }

      await this.cleanupTaskResources();

      return output;
    } catch (error) {
      OrchestratorLogger.log('Running job failed');
      core.error(JSON.stringify(error, undefined, 4));

      // await this.cleanupTaskResources();
      throw error;
    }
  }

  private async createJob(
    commands: string,
    image: string,
    mountdir: string,
    workingdir: string,
    environment: OrchestratorEnvironmentVariable[],
    secrets: OrchestratorSecret[],
  ) {
    await this.createNamespacedJob(commands, image, mountdir, workingdir, environment, secrets);
    const find = await Kubernetes.findPodFromJob(this.kubeClient, this.jobName, this.namespace);
    this.setPodNameAndContainerName(find);
  }

  private async doesJobExist(name: string) {
    const jobs = await this.kubeClientBatch.listNamespacedJob(this.namespace);

    return jobs.body.items.some((x) => x.metadata?.name === name);
  }

  private async doesFailedJobExist() {
    const podStatus = await this.kubeClient.readNamespacedPodStatus(this.podName, this.namespace);

    return podStatus.body.status?.phase === `Failed`;
  }

  private async createNamespacedJob(
    commands: string,
    image: string,
    mountdir: string,
    workingdir: string,
    environment: OrchestratorEnvironmentVariable[],
    secrets: OrchestratorSecret[],
  ) {
    for (let index = 0; index < 3; index++) {
      try {
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
          this.containerName,
          this.ip,
        );
        await new Promise((promise) => setTimeout(promise, 15000));

        // await KubernetesRole.createRole(this.serviceAccountName, this.namespace, this.rbacAuthorizationV1Api);

        const result = await this.kubeClientBatch.createNamespacedJob(this.namespace, jobSpec);
        OrchestratorLogger.log(`Build job created`);
        await new Promise((promise) => setTimeout(promise, 5000));
        OrchestratorLogger.log('Job created');

        return result.body.metadata?.name;
      } catch (error) {
        OrchestratorLogger.log(`Error occured creating job: ${error}`);
        throw error;
      }
    }
  }

  setPodNameAndContainerName(pod: k8s.V1Pod) {
    this.podName = pod.metadata?.name || '';
    this.containerName = pod.status?.containerStatuses?.[0].name || this.containerName;
  }

  async cleanupTaskResources() {
    OrchestratorLogger.log('cleaning up');
    try {
      await this.kubeClientBatch.deleteNamespacedJob(this.jobName, this.namespace);
      await this.kubeClient.deleteNamespacedPod(this.podName, this.namespace);
      await KubernetesRole.deleteRole(this.serviceAccountName, this.namespace, this.rbacAuthorizationV1Api);
    } catch (error: any) {
      OrchestratorLogger.log(`Failed to cleanup`);
      if (error.response.body.reason !== `NotFound`) {
        OrchestratorLogger.log(`Wasn't a not found error: ${error.response.body.reason}`);
        throw error;
      }
    }
    try {
      await this.kubeClient.deleteNamespacedSecret(this.secretName, this.namespace);
    } catch (error: any) {
      OrchestratorLogger.log(`Failed to cleanup secret`);
      OrchestratorLogger.log(error.response.body.reason);
    }
    OrchestratorLogger.log('cleaned up Secret, Job and Pod');
    OrchestratorLogger.log('cleaning up finished');
  }

  async cleanupWorkflow(
    buildParameters: BuildParameters,
    // eslint-disable-next-line no-unused-vars
    branchName: string,
    // eslint-disable-next-line no-unused-vars
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {
    if (BuildParameters && BuildParameters.shouldUseRetainedWorkspaceMode(buildParameters)) {
      return;
    }
    OrchestratorLogger.log(`deleting PVC`);

    try {
      await this.kubeClient.deleteNamespacedPersistentVolumeClaim(this.pvcName, this.namespace);
      await this.kubeClient.deleteNamespacedServiceAccount(this.serviceAccountName, this.namespace);
      OrchestratorLogger.log('cleaned up PVC and Service Account');
    } catch (error: any) {
      OrchestratorLogger.log(`Cleanup failed ${JSON.stringify(error, undefined, 4)}`);
      throw error;
    }
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
