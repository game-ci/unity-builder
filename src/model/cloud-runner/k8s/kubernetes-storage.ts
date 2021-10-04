import waitUntil from 'async-wait-until';
import * as core from '@actions/core';
import * as k8s from '@kubernetes/client-node';
import BuildParameters from '../../build-parameters';
import CloudRunnerLogger from '../services/cloud-runner-logger';

class KubernetesStorage {
  public static async createPersistentVolumeClaim(
    buildParameters: BuildParameters,
    pvcName: string,
    kubeClient: k8s.CoreV1Api,
    namespace: string,
  ) {
    if (buildParameters.kubeVolume) {
      CloudRunnerLogger.log(buildParameters.kubeVolume);
      pvcName = buildParameters.kubeVolume;
      return;
    }
    const pvcList = (await kubeClient.listNamespacedPersistentVolumeClaim(namespace)).body.items.map(
      (x) => x.metadata?.name,
    );
    CloudRunnerLogger.log(`Current PVCs in namespace ${namespace}`);
    CloudRunnerLogger.log(JSON.stringify(pvcList, undefined, 4));
    if (pvcList.includes(pvcName)) {
      CloudRunnerLogger.log(`pvc ${pvcName} already exists`);
      core.setOutput('volume', pvcName);
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
          return (await this.getPVCPhase(kubeClient, name, namespace)) !== 'Pending';
        },
        {
          timeout: 500000,
          intervalBetweenAttempts: 15000,
        },
      );
    } catch (error) {
      core.error('Failed to watch PVC');
      core.error(error);
      core.error(JSON.stringify(error, undefined, 4));
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
      storageClassName: process.env.K8s_STORAGE_CLASS || 'standard',
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
    result: { response: import('http').IncomingMessage; body: k8s.V1PersistentVolumeClaim },
    kubeClient: k8s.CoreV1Api,
    namespace: string,
    pvcName: string,
  ) {
    const name = result.body.metadata?.name;
    if (!name) throw new Error('failed to create PVC');
    CloudRunnerLogger.log(
      JSON.stringify(await kubeClient.readNamespacedPersistentVolumeClaim(name, namespace), undefined, 4),
    );
    CloudRunnerLogger.log(`PVC ${name} created`);
    await this.watchUntilPVCNotPending(kubeClient, name, namespace);
    CloudRunnerLogger.log(`PVC ${name} is ready and not pending`);
    core.setOutput('volume', pvcName);
  }
}

export default KubernetesStorage;
