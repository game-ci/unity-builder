import fs from 'fs';
import { CloudRunnerSystem } from '../../cli/remote-client/remote-client-services/cloud-runner-system';
import CloudRunnerLogger from '../services/cloud-runner-logger';

class KubernetesRook {
  public static readonly rookStorageName = 'rook-cephfs-game-ci';
  public static async InitRook(storageName) {
    if (storageName === '' && (await CloudRunnerSystem.Run(`kubectl`))) {
      storageName = KubernetesRook.rookStorageName;
      CloudRunnerLogger.log('Using rook storage as no kubeStorageClass provided');
      await CloudRunnerSystem.Run(`
        git clone --single-branch --branch v1.8.6 https://github.com/rook/rook.git
        cd rook/deploy/examples
        kubectl apply -f crds.yaml -f common.yaml -f operator.yaml
        kubectl apply -f cluster.yaml
      `);
      fs.writeFileSync(
        'filesystem.yaml',
        `
        apiVersion: ceph.rook.io/v1
        kind: CephFilesystem
        metadata:
          name: myfs
          namespace: rook-ceph
        spec:
          metadataPool:
            replicated:
              size: 3
          dataPools:
            - name: replicated
              replicated:
                size: 3
          preserveFilesystemOnDelete: true
          metadataServer:
            activeCount: 1
            activeStandby: true
      `,
      );
      fs.writeFileSync(
        'storageclass.yaml',
        `
        apiVersion: storage.k8s.io/v1
        kind: StorageClass
        metadata:
          name: ${storageName}
        # Change "rook-ceph" provisioner prefix to match the operator namespace if needed
        provisioner: rook-ceph.cephfs.csi.ceph.com
        parameters:
          # clusterID is the namespace where the rook cluster is running
          # If you change this namespace, also change the namespace below where the secret namespaces are defined
          clusterID: rook-ceph

          # CephFS filesystem name into which the volume shall be created
          fsName: myfs

          # Ceph pool into which the volume shall be created
          # Required for provisionVolume: "true"
          pool: myfs-replicated

          # The secrets contain Ceph admin credentials. These are generated automatically by the operator
          # in the same namespace as the cluster.
          csi.storage.k8s.io/provisioner-secret-name: rook-csi-cephfs-provisioner
          csi.storage.k8s.io/provisioner-secret-namespace: rook-ceph
          csi.storage.k8s.io/controller-expand-secret-name: rook-csi-cephfs-provisioner
          csi.storage.k8s.io/controller-expand-secret-namespace: rook-ceph
          csi.storage.k8s.io/node-stage-secret-name: rook-csi-cephfs-node
          csi.storage.k8s.io/node-stage-secret-namespace: rook-ceph
        reclaimPolicy: Delete
      `,
      );
      await CloudRunnerSystem.Run(`
        kubectl apply -f storageclass.yaml -f filesystem.yaml
      `);
    } else {
      CloudRunnerLogger.log(`Using kubeStorageClass ${storageName}`);
    }
  }
}

export default KubernetesRook;
