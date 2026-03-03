import { CoreV1Api } from '@kubernetes/client-node';
import OrchestratorSecret from '../../options/orchestrator-secret';
import * as k8s from '@kubernetes/client-node';
import OrchestratorLogger from '../../services/core/orchestrator-logger';
import * as base64 from 'base-64';

class KubernetesSecret {
  static async createSecret(
    secrets: OrchestratorSecret[],
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
      OrchestratorLogger.log(`Creating secret: ${secretName}`);
      const existingSecrets = await kubeClient.listNamespacedSecret(namespace);
      const mappedSecrets = existingSecrets.body.items.map((x) => {
        return x.metadata?.name || `no name`;
      });

      OrchestratorLogger.log(
        `ExistsAlready: ${mappedSecrets.includes(secretName)} SecretsCount: ${mappedSecrets.length}`,
      );
      await new Promise((promise) => setTimeout(promise, 15000));
      await kubeClient.createNamespacedSecret(namespace, secret);
      OrchestratorLogger.log('Created secret');
    } catch (error) {
      OrchestratorLogger.log(`Created secret failed ${error}`);
      throw new Error(`Failed to create kubernetes secret`);
    }
  }
}

export default KubernetesSecret;
