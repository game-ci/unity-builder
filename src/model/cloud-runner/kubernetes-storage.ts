import waitUntil from 'async-wait-until';
import * as core from '@actions/core';
import * as k8s from '@kubernetes/client-node';
import BuildParameters from '../build-parameters';

class KubernetesStorage {
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
    const pvcList = (await kubeClient.listNamespacedPersistentVolumeClaim(namespace)).body.items.map(
      (x) => x.metadata?.name,
    );
    core.info(`Current PVCs in namespace ${namespace}`);
    core.info(JSON.stringify(pvcList, undefined, 4));
    if (pvcList.includes(pvcName)) {
      core.info(`pvc ${pvcName} already exists`);
      core.setOutput('volume', pvcName);
      return;
    }
    core.info(`Creating PVC ${pvcName} (does not exist)`);
    const result = await KubernetesStorage.createPVC(pvcName, buildParameters, kubeClient, namespace);
    await KubernetesStorage.handleResult(result, kubeClient, namespace, pvcName);
  }

  public static async getPVCPhase(kubeClient: k8s.CoreV1Api, name: string, namespace: string) {
    return (await kubeClient.readNamespacedPersistentVolumeClaim(name, namespace)).body.status?.phase;
  }

  public static async watchUntilPVCNotPending(kubeClient: k8s.CoreV1Api, name: string, namespace: string) {
    core.info(`watch Until PVC Not Pending ${name} ${namespace}`);
    core.info(`${await this.getPVCPhase(kubeClient, name, namespace)}`);
    await waitUntil(async () => (await this.getPVCPhase(kubeClient, name, namespace)) !== 'Pending', {
      timeout: 500000,
      intervalBetweenAttempts: 15000,
    });
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
      accessModes: ['ReadWriteMany'],
      storageClassName: 'fileserver',
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
    core.info(JSON.stringify(await kubeClient.readNamespacedPersistentVolumeClaim(name, namespace), undefined, 4));
    core.info(`PVC ${name} created`);
    await this.watchUntilPVCNotPending(kubeClient, name, namespace);
    core.info(`PVC ${name} is ready and not pending`);
    core.setOutput('volume', pvcName);
  }
}

export default KubernetesStorage;

/*
It's possible now with Cloud Filestore.

First create a Filestore instance.

gcloud filestore instances create nfs-server
    --project=[PROJECT_ID]
    --zone=us-central1-c
    --tier=STANDARD
    --file-share=name="vol1",capacity=1TB
    --network=name="default",reserved-ip-range="10.0.0.0/29"
Then create a persistent volume in GKE.

apiVersion: v1
kind: PersistentVolume
metadata:
  name: fileserver
spec:
  capacity:
    storage: 1T
  accessModes:
  - ReadWriteMany
  nfs:
    path: /vol1
    server: [IP_ADDRESS]
[IP_ADDRESS] is available in filestore instance details.

You can now request a persistent volume claim.

apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: fileserver-claim
spec:
  accessModes:
  - ReadWriteMany
  storageClassName: "fileserver"
  resources:
    requests:
      storage: 100G
Finally, mount the volume in your pod.

apiVersion: v1
kind: Pod
metadata:
  name: my-pod
spec:
  containers:
  - name: my container
    image: nginx:latest
    volumeMounts:
    - mountPath: /workdir
      name: mypvc
  volumes:
  - name: mypvc
    persistentVolumeClaim:
      claimName: fileserver-claim
      readOnly: false
Solution is detailed here : https://cloud.google.com/filestore/docs/accessing-fileshares
*/
