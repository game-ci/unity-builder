import { k8s, k8sTypes } from '../../../../dependencies.ts';

class KubernetesServiceAccount {
  static async createServiceAccount(serviceAccountName: string, namespace: string, kubeClient: k8sTypes.CoreV1Api) {
    const serviceAccount = new k8s.V1ServiceAccount();
    serviceAccount.apiVersion = 'v1';
    serviceAccount.kind = 'ServiceAccount';
    serviceAccount.metadata = {
      name: serviceAccountName,
    };
    serviceAccount.automountServiceAccountToken = false;

    return kubeClient.createNamespacedServiceAccount(namespace, serviceAccount);
  }
}

export default KubernetesServiceAccount;
