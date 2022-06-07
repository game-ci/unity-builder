import { CoreV1Api } from '@kubernetes/client-node';
import CloudRunnerSecret from '../../services/cloud-runner-secret.ts';
import * as k8s from '@kubernetes/client-node';
const base64 = require('base-64');

class KubernetesSecret {
  static async createSecret(
    secrets: CloudRunnerSecret[],
    secretName: string,
    namespace: string,
    kubeClient: CoreV1Api,
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
