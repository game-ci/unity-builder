import CloudRunnerLogger from '../../services/core/cloud-runner-logger';
import { CoreV1Api } from '@kubernetes/client-node';
class KubernetesPods {
  public static async IsPodRunning(podName: string, namespace: string, kubeClient: CoreV1Api) {
    const pods = (await kubeClient.listNamespacedPod(namespace)).body.items.filter((x) => podName === x.metadata?.name);
    const running = pods.length > 0 && (pods[0].status?.phase === `Running` || pods[0].status?.phase === `Pending`);
    const phase = pods[0]?.status?.phase || 'undefined status';
    CloudRunnerLogger.log(`Getting pod status: ${phase}`);
    if (phase === `Failed`) {
      throw new Error(`K8s pod failed`);
    }

    return running;
  }
  public static async GetPodStatus(podName: string, namespace: string, kubeClient: CoreV1Api) {
    const pods = (await kubeClient.listNamespacedPod(namespace)).body.items.find((x) => podName === x.metadata?.name);
    const phase = pods?.status?.phase || 'undefined status';

    return phase;
  }
}

export default KubernetesPods;
