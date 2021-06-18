import waitUntil from 'async-wait-until';
import * as core from '@actions/core';
import * as k8s from '@kubernetes/client-node';

class KubernetesStorage {
  public static async getPVCPhase(kubeClient, name, namespace) {
    return (await kubeClient.readNamespacedPersistentVolumeClaimStatus(name, namespace)).body.status?.phase;
  }
  public static async watchPersistentVolumeClaimUntilBoundToContainer(kubeClient, name, namespace) {
    await waitUntil(async () => (await this.getPVCPhase(kubeClient, name, namespace)) !== 'Pending', {
      timeout: 50000,
    });
  }

  public static async createPersistentVolumeClaim(buildParameters, pvcName, kubeClient, namespace) {
    if (buildParameters.kubeVolume) {
      core.info(buildParameters.kubeVolume);
      pvcName = buildParameters.kubeVolume;
      return;
    }
    const pvc = new k8s.V1PersistentVolumeClaim();
    pvc.apiVersion = 'v1';
    pvc.kind = 'PersistentVolumeClaim';
    pvc.metadata = {
      name: pvcName,
    };
    pvc.spec = {
      accessModes: ['ReadWriteOnce'],
      volumeMode: 'Filesystem',
      resources: {
        requests: {
          storage: buildParameters.kubeVolumeSize,
        },
      },
    };
    await kubeClient.createNamespacedPersistentVolumeClaim(namespace, pvc);
    core.info(`Persistent Volume created, ${await KubernetesStorage.getPVCPhase(kubeClient, pvcName, namespace)}`);
    // await this.watchPersistentVolumeClaimUntilBoundToContainer(kubeClient, pvcName, namespace);
    core.info(
      JSON.stringify(
        (await kubeClient.readNamespacedPersistentVolumeClaimStatus(pvcName, namespace)).body,
        undefined,
        4,
      ),
    );
  }
}

export default KubernetesStorage;
