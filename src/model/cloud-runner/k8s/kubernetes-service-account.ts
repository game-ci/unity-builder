import { CoreV1Api } from '@kubernetes/client-node';
import * as k8s from '@kubernetes/client-node';

class KubernetesServiceAccount {
  static async createServiceAccount(serviceAccountName: string, namespace: string, kubeClient: CoreV1Api) {
    const serviceAccount = new k8s.V1ServiceAccount();
    serviceAccount.apiVersion = 'v1';
    serviceAccount.kind = 'ServiceAccount';
    serviceAccount.metadata = {
      name: serviceAccountName,
    };
    serviceAccount.automountServiceAccountToken = false;
    try {
      await kubeClient.createNamespacedServiceAccount(namespace, serviceAccount);
    } catch (error) {
      throw error;
    }
  }
}

export default KubernetesServiceAccount;
