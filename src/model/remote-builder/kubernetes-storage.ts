import waitUntil from 'async-wait-until';
import * as core from '@actions/core';
import * as k8s from '@kubernetes/client-node';
import BuildParameters from '../build-parameters';

class KubernetesStorage {
  public static async getPVCPhase(kubeClient: k8s.CoreV1Api, name: string, namespace: string) {
    return (await kubeClient.readNamespacedPersistentVolumeClaimStatus(name, namespace)).body.status?.phase;
  }
  public static async watchPersistentVolumeClaimUntilBoundToContainer(
    kubeClient: k8s.CoreV1Api,
    name: string,
    namespace: string,
  ) {
    await waitUntil(async () => (await this.getPVCPhase(kubeClient, name, namespace)) !== 'Pending', {
      timeout: 500000,
    });

    core.info(
      JSON.stringify((await kubeClient.readNamespacedPersistentVolumeClaimStatus(name, namespace)).body, undefined, 4),
    );

    const pvc = (await kubeClient.readNamespacedPersistentVolumeClaim(name, namespace)).body;

    core.info(JSON.stringify(pvc, undefined, 4));

    core.info(
      JSON.stringify((await kubeClient.readNamespacedPersistentVolumeClaim(name, namespace)).body, undefined, 4),
    );

    core.info(
      JSON.stringify(
        (await kubeClient.replaceNamespacedPersistentVolumeClaimStatus(name, namespace, pvc)).body,
        undefined,
        4,
      ),
    );
  }

  public static async createPersistentVolumeClaim(
    buildParameters: BuildParameters,
    pvcName: string,
    kubeClient: k8s.CoreV1Api,
    namespace: string,
  ) {
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
  }
}

export default KubernetesStorage;
