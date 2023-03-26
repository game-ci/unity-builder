import { CoreV1Api } from '@kubernetes/client-node';
import CloudRunnerSecret from '../../options/cloud-runner-secret';
import * as k8s from '@kubernetes/client-node';
import CloudRunnerLogger from '../../services/core/cloud-runner-logger';
import * as base64 from 'base-64';

class KubernetesSecret {
  static async createSecret(
    secrets: CloudRunnerSecret[],
    secretName: string,
    namespace: string,
    kubeClient: CoreV1Api,
  ) {
    try {
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
      CloudRunnerLogger.log(`Creating secret: ${secretName}`);
      const existingSecrets = await kubeClient.listNamespacedSecret(namespace);
      const mappedSecrets = existingSecrets.body.items.map((x) => {
        return x.metadata?.name || `no name`;
      });

      CloudRunnerLogger.log(
        `ExistsAlready: ${mappedSecrets.includes(secretName)} SecretsCount: ${mappedSecrets.length}`,
      );
      await new Promise((promise) => setTimeout(promise, 15000));
      await kubeClient.createNamespacedSecret(namespace, secret);
      CloudRunnerLogger.log('Created secret');
    } catch (error) {
      CloudRunnerLogger.log(`Created secret failed ${error}`);
      throw new Error(`Failed to create kubernetes secret`);
    }
  }
}

export default KubernetesSecret;
