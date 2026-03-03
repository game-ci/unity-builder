import { waitUntil } from 'async-wait-until';
import * as core from '@actions/core';
import * as k8s from '@kubernetes/client-node';
import BuildParameters from '../../../build-parameters';
import CloudRunnerLogger from '../../services/core/cloud-runner-logger';
import { IncomingMessage } from 'node:http';
import GitHub from '../../../github';

class KubernetesStorage {
  public static async createPersistentVolumeClaim(
    buildParameters: BuildParameters,
    pvcName: string,
    kubeClient: k8s.CoreV1Api,
    namespace: string,
  ) {
    if (buildParameters.kubeVolume !== ``) {
      CloudRunnerLogger.log(`Kube Volume was input was set ${buildParameters.kubeVolume} overriding ${pvcName}`);
      pvcName = buildParameters.kubeVolume;

      return;
    }
    const allPvc = (await kubeClient.listNamespacedPersistentVolumeClaim(namespace)).body.items;
    const pvcList = allPvc.map((x) => x.metadata?.name);
    CloudRunnerLogger.log(`Current PVCs in namespace ${namespace}`);
    CloudRunnerLogger.log(JSON.stringify(pvcList, undefined, 4));
    if (pvcList.includes(pvcName)) {
      CloudRunnerLogger.log(`pvc ${pvcName} already exists`);
      if (GitHub.githubInputEnabled) {
        core.setOutput('volume', pvcName);
      }

      return;
    }
    CloudRunnerLogger.log(`Creating PVC ${pvcName} (does not exist)`);
    const result = await KubernetesStorage.createPVC(pvcName, buildParameters, kubeClient, namespace);
    await KubernetesStorage.handleResult(result, kubeClient, namespace, pvcName);
  }

  public static async getPVCPhase(kubeClient: k8s.CoreV1Api, name: string, namespace: string) {
    try {
      return (await kubeClient.readNamespacedPersistentVolumeClaim(name, namespace)).body.status?.phase;
    } catch (error) {
      core.error('Failed to get PVC phase');
      core.error(JSON.stringify(error, undefined, 4));
      throw error;
    }
  }

  public static async watchUntilPVCNotPending(kubeClient: k8s.CoreV1Api, name: string, namespace: string) {
    let checkCount = 0;
    try {
      CloudRunnerLogger.log(`watch Until PVC Not Pending ${name} ${namespace}`);

      // Check if storage class uses WaitForFirstConsumer binding mode
      // If so, skip waiting - PVC will bind when pod is created
      let shouldSkipWait = false;
      try {
        const pvcBody = (await kubeClient.readNamespacedPersistentVolumeClaim(name, namespace)).body;
        const storageClassName = pvcBody.spec?.storageClassName;

        if (storageClassName) {
          const kubeConfig = new k8s.KubeConfig();
          kubeConfig.loadFromDefault();
          const storageV1Api = kubeConfig.makeApiClient(k8s.StorageV1Api);

          try {
            const sc = await storageV1Api.readStorageClass(storageClassName);
            const volumeBindingMode = sc.body.volumeBindingMode;

            if (volumeBindingMode === 'WaitForFirstConsumer') {
              CloudRunnerLogger.log(
                `StorageClass "${storageClassName}" uses WaitForFirstConsumer binding mode. PVC will bind when pod is created. Skipping wait.`,
              );
              shouldSkipWait = true;
            }
          } catch (scError) {
            // If we can't check the storage class, proceed with normal wait
            CloudRunnerLogger.log(
              `Could not check storage class binding mode: ${scError}. Proceeding with normal wait.`,
            );
          }
        }
      } catch (pvcReadError) {
        // If we can't read PVC, proceed with normal wait
        CloudRunnerLogger.log(
          `Could not read PVC to check storage class: ${pvcReadError}. Proceeding with normal wait.`,
        );
      }

      if (shouldSkipWait) {
        CloudRunnerLogger.log(`Skipping PVC wait - will bind when pod is created`);

        return;
      }

      const initialPhase = await this.getPVCPhase(kubeClient, name, namespace);
      CloudRunnerLogger.log(`Initial PVC phase: ${initialPhase}`);

      // Wait until PVC is NOT Pending (i.e., Bound or Available)
      await waitUntil(
        async () => {
          checkCount++;
          const phase = await this.getPVCPhase(kubeClient, name, namespace);

          // Log progress every 4 checks (every ~60 seconds)
          if (checkCount % 4 === 0) {
            CloudRunnerLogger.log(`PVC ${name} still ${phase} (check ${checkCount})`);

            // Fetch and log PVC events for diagnostics
            try {
              const events = await kubeClient.listNamespacedEvent(namespace);
              const pvcEvents = events.body.items
                .filter((x) => x.involvedObject?.kind === 'PersistentVolumeClaim' && x.involvedObject?.name === name)
                .map((x) => ({
                  message: x.message || '',
                  reason: x.reason || '',
                  type: x.type || '',
                  count: x.count || 0,
                }))
                .slice(-5); // Get last 5 events

              if (pvcEvents.length > 0) {
                CloudRunnerLogger.log(`PVC Events: ${JSON.stringify(pvcEvents, undefined, 2)}`);

                // Check if event indicates WaitForFirstConsumer
                const waitForConsumerEvent = pvcEvents.find(
                  (event) =>
                    event.reason === 'WaitForFirstConsumer' || event.message?.includes('waiting for first consumer'),
                );
                if (waitForConsumerEvent) {
                  CloudRunnerLogger.log(
                    `PVC is waiting for first consumer. This is normal for WaitForFirstConsumer storage classes. Proceeding without waiting.`,
                  );

                  return true; // Exit wait loop - PVC will bind when pod is created
                }
              }
            } catch {
              // Ignore event fetch errors
            }
          }

          return phase !== 'Pending';
        },
        {
          timeout: 750000,
          intervalBetweenAttempts: 15000,
        },
      );

      const finalPhase = await this.getPVCPhase(kubeClient, name, namespace);
      CloudRunnerLogger.log(`PVC phase after wait: ${finalPhase}`);

      if (finalPhase === 'Pending') {
        throw new Error(`PVC ${name} is still Pending after timeout`);
      }
    } catch (error: any) {
      core.error('Failed to watch PVC');
      core.error(error.toString());
      try {
        const pvcBody = (await kubeClient.readNamespacedPersistentVolumeClaim(name, namespace)).body;

        // Fetch PVC events for detailed diagnostics
        let pvcEvents: any[] = [];
        try {
          const events = await kubeClient.listNamespacedEvent(namespace);
          pvcEvents = events.body.items
            .filter((x) => x.involvedObject?.kind === 'PersistentVolumeClaim' && x.involvedObject?.name === name)
            .map((x) => ({
              message: x.message || '',
              reason: x.reason || '',
              type: x.type || '',
              count: x.count || 0,
            }));
        } catch {
          // Ignore event fetch errors
        }

        // Check if storage class exists
        let storageClassInfo = '';
        try {
          const storageClassName = pvcBody.spec?.storageClassName;
          if (storageClassName) {
            // Create StorageV1Api from default config
            const kubeConfig = new k8s.KubeConfig();
            kubeConfig.loadFromDefault();
            const storageV1Api = kubeConfig.makeApiClient(k8s.StorageV1Api);

            try {
              const sc = await storageV1Api.readStorageClass(storageClassName);
              storageClassInfo = `StorageClass "${storageClassName}" exists. Provisioner: ${
                sc.body.provisioner || 'unknown'
              }`;
            } catch (scError: any) {
              storageClassInfo =
                scError.statusCode === 404
                  ? `StorageClass "${storageClassName}" does NOT exist! This is likely why the PVC is stuck in Pending.`
                  : `Failed to check StorageClass "${storageClassName}": ${scError.message || scError}`;
            }
          }
        } catch (scCheckError) {
          // Ignore storage class check errors - not critical for diagnostics
          storageClassInfo = `Could not check storage class: ${scCheckError}`;
        }

        core.error(
          `PVC Body: ${JSON.stringify(
            {
              phase: pvcBody.status?.phase,
              conditions: pvcBody.status?.conditions,
              accessModes: pvcBody.spec?.accessModes,
              storageClassName: pvcBody.spec?.storageClassName,
              storageRequest: pvcBody.spec?.resources?.requests?.storage,
            },
            undefined,
            4,
          )}`,
        );

        if (storageClassInfo) {
          core.error(storageClassInfo);
        }

        if (pvcEvents.length > 0) {
          core.error(`PVC Events: ${JSON.stringify(pvcEvents, undefined, 2)}`);
        } else {
          core.error('No PVC events found - this may indicate the storage provisioner is not responding');
        }
      } catch {
        // Ignore PVC read errors
      }
      throw error;
    }
  }

  private static async createPVC(
    pvcName: string,
    buildParameters: BuildParameters,
    kubeClient: k8s.CoreV1Api,
    namespace: string,
  ) {
    const pvc = new k8s.V1PersistentVolumeClaim();
    pvc.apiVersion = 'v1';
    pvc.kind = 'PersistentVolumeClaim';
    pvc.metadata = {
      name: pvcName,
    };
    pvc.spec = {
      accessModes: ['ReadWriteOnce'],
      storageClassName: buildParameters.kubeStorageClass === '' ? 'standard' : buildParameters.kubeStorageClass,
      resources: {
        requests: {
          storage: buildParameters.kubeVolumeSize,
        },
      },
    };
    const result = await kubeClient.createNamespacedPersistentVolumeClaim(namespace, pvc);

    return result;
  }

  private static async handleResult(
    result: { response: IncomingMessage; body: k8s.V1PersistentVolumeClaim },
    kubeClient: k8s.CoreV1Api,
    namespace: string,
    pvcName: string,
  ) {
    const name = result.body.metadata?.name || '';
    CloudRunnerLogger.log(`PVC ${name} created`);
    await this.watchUntilPVCNotPending(kubeClient, name, namespace);
    CloudRunnerLogger.log(`PVC ${name} is ready and not pending`);
    core.setOutput('volume', pvcName);
  }
}

export default KubernetesStorage;
