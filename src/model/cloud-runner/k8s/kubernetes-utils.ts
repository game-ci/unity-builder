import { CoreV1Api } from '@kubernetes/client-node';
import waitUntil from 'async-wait-until';
import CloudRunnerLogger from '../services/cloud-runner-logger';

class KubernetesUtilities {
  static async findPodFromJob(kubeClient: CoreV1Api, jobName: string, namespace: string) {
    const namespacedPods = await kubeClient.listNamespacedPod(namespace);
    const pod = namespacedPods.body.items.find((x) => x.metadata?.labels?.['job-name'] === jobName);
    if (pod === undefined) {
      throw new Error("pod with job-name label doesn't exist");
    }
    return pod;
  }

  static async watchUntilPodRunning(kubeClient: CoreV1Api, podName: string, namespace: string) {
    let success: boolean = false;
    CloudRunnerLogger.log(`Watching ${podName} ${namespace}`);
    await waitUntil(
      async () => {
        const phase = (await kubeClient.readNamespacedPodStatus(podName, namespace))?.body.status?.phase;
        success = phase === 'Running';
        if (success || phase !== 'Pending') return true;
        return false;
      },
      {
        timeout: 500000,
        intervalBetweenAttempts: 15000,
      },
    );
    return success;
  }
}
export default KubernetesUtilities;
