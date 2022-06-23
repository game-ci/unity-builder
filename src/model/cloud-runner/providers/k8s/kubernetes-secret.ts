import { k8sTypes, k8s, base64 } from '../../../../dependencies.ts';
import CloudRunnerSecret from '../../services/cloud-runner-secret.ts';

class KubernetesSecret {
  static async createSecret(
    secrets: CloudRunnerSecret[],
    secretName: string,
    namespace: string,
    kubeClient: k8sTypes.CoreV1Api,
  ) {
    const secret = new k8s.V1Secret();
    secret.apiVersion = 'v1';
    secret.kind = 'Secret';
    secret.type = 'Opaque';
    secret.metadata = {
      name: secretName,
    };
    secret.data = {};
    for (const buildSecret of secrets) {
      secret.data[buildSecret.ParameterKey] = base64.encode(buildSecret.ParameterValue);
    }

    return kubeClient.createNamespacedSecret(namespace, secret);
  }
}

export default KubernetesSecret;
