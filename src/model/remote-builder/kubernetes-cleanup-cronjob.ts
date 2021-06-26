import { BatchV1beta1Api, V1beta1CronJob } from '@kubernetes/client-node';
import { Cron } from 'cron-converter';
class KubernetesCleanupCronJob {
  static async cleanup(api: BatchV1beta1Api, name: string, namespace: string) {
    await api.deleteNamespacedCronJob('name', namespace);
  }
  static createCleanupCronJob(kubeClientBatch: BatchV1beta1Api, name: string, namespace: string) {
    const batchJob = new V1beta1CronJob();
    batchJob.kind = 'CronJob';
    batchJob.metadata = {
      name,
      labels: {
        app: 'unity-builder',
      },
    };
    const cronInstance = new Cron();
    const date = Date.now() + 1000 * 60 * 60;
    const spec = {
      containers: [
        {
          name: 'main',
          image: 'bitnami/kubectl',
          imagePullPolicy: '',
          command: ['/bin/sh'],
          args: [
            '-c',
            `
            echo "delete the kubernetes resources"
            kubectl get pods
            `,
          ],
          restartPolicy: '',
        },
      ],
    };
    batchJob.spec = {
      schedule: cronInstance.schedule(new Date(date)).toString(),
      jobTemplate: {
        spec: {
          template: { spec },
        },
      },
    };

    kubeClientBatch.createNamespacedCronJob(namespace, batchJob);
  }
}
export default KubernetesCleanupCronJob;
