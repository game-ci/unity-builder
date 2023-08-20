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
    try {
      CloudRunnerLogger.log(`watch Until PVC Not Pending ${name} ${namespace}`);
      CloudRunnerLogger.log(`${await this.getPVCPhase(kubeClient, name, namespace)}`);
      await waitUntil(
        async () => {
          return (await this.getPVCPhase(kubeClient, name, namespace)) === 'Pending';
        },
        {
          timeout: 750000,
          intervalBetweenAttempts: 15000,
        },
      );
    } catch (error: any) {
      core.error('Failed to watch PVC');
      core.error(error.toString());
      core.error(
        `PVC Body: ${JSON.stringify(
          (await kubeClient.readNamespacedPersistentVolumeClaim(name, namespace)).body,
          undefined,
          4,
        )}`,
      );
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
