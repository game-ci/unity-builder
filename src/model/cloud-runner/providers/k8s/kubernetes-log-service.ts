import { CoreV1Api } from '@kubernetes/client-node';
import * as k8s from '@kubernetes/client-node';
import CloudRunnerLogger from '../../services/core/cloud-runner-logger';
import { CloudRunnerSystem } from '../../services/core/cloud-runner-system';
class KubernetesLogService {
  static async cleanupLogDeployment(namespace: string, kubeClientApps: k8s.AppsV1Api, kubeClient: CoreV1Api) {
    await kubeClient.deleteNamespacedService('http-fileserver', namespace);
    await kubeClientApps.deleteNamespacedDeployment('http-fileserver', namespace);
  }

  static async createLogService(serviceAccountName: string, namespace: string, kubeClient: CoreV1Api) {
    const serviceAccount = new k8s.V1ServiceAccount();
    serviceAccount.apiVersion = 'v1';
    serviceAccount.kind = 'ServiceAccount';
    serviceAccount.metadata = {
      name: serviceAccountName,
    };
    serviceAccount.automountServiceAccountToken = true;

    return kubeClient.createNamespacedServiceAccount(namespace, serviceAccount);
  }

  static async createLogDeployment(namespace: string, kubeClient: k8s.AppsV1Api, kubeClientCore: CoreV1Api) {
    if (!process.env.LOG_SERVICE_IP) {
      return `0.0.0.0`;
    }

    // create a deployment with above json
    const deployment = new k8s.V1Deployment();
    deployment.apiVersion = 'apps/v1';
    deployment.kind = 'Deployment';
    deployment.metadata = {
      name: 'http-fileserver',
      labels: {
        service: 'http-fileserver',
      },
    };
    deployment.spec = {
      selector: {
        matchLabels: {
          service: 'http-fileserver',
        },
      },
      replicas: 1,
      strategy: {},
      template: {
        metadata: {
          labels: {
            service: 'http-fileserver',
          },
        },
        spec: {
          containers: [
            {
              image: 'node:18',
              imagePullPolicy: 'Always',
              name: 'http-fileserver',
              ports: [{ containerPort: 80 }],
              command: [
                'bash',
                '-c',
                'while true; do sleep 30; npm i files-upload-server -g; files-upload-server "downloads"; done;',
              ],
              resources: {
                requests: {
                  memory: '750M',
                  cpu: '0.25',
                },
              },
            },
          ],
          restartPolicy: 'Always',
        },
      },
    };
    await kubeClient.createNamespacedDeployment(namespace, deployment);
    await this.createLogServiceExpose(namespace, kubeClientCore);

    // wait in loop until serivce ip address is exposed

    for (let index = 0; index < 10; index++) {
      // wait for service to share ip address
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // get cluster ip address of service
      const service = await kubeClientCore.readNamespacedService('http-fileserver', namespace);

      // get podname of deployment

      const podname = await CloudRunnerSystem.Run(
        `kubectl get pods -n ${namespace} -l service=http-fileserver -o jsonpath='{.items[0].metadata.name}'`,
        false,
        true,
      );

      // if status of pod is not running, then continue
      const podStatus = await CloudRunnerSystem.Run(
        `kubectl get pods -n ${namespace} ${podname} -o jsonpath='{.status.phase}'`,
        false,
        true,
      );
      if (podStatus !== 'Running') {
        CloudRunnerLogger.log(`Pod status: ${podStatus}`);
        continue;
      }

      const logs = await CloudRunnerSystem.Run(`kubectl logs ${podname} -f --timestamps -p`, false, true);
      CloudRunnerLogger.log(`Logs: ${logs}`);

      // get cluster ip
      const ip = service.body?.spec?.clusterIP;
      if (ip && ip.length > 0) {
        // log service json
        CloudRunnerLogger.log(`Service: ${JSON.stringify(service.body, undefined, 4)}`);
        CloudRunnerLogger.log(`Service IP: ${ip}`);

        return ip;
      }
    }
  }

  // create kubernetes service to expose deployment
  static async createLogServiceExpose(namespace: string, kubeClient: CoreV1Api) {
    if (!process.env.LOG_SERVICE_IP) {
      return;
    }

    // create a service with above json
    const service = new k8s.V1Service();
    service.apiVersion = 'v1';
    service.kind = 'Service';
    service.metadata = {
      name: 'http-fileserver',
      labels: {
        service: 'http-fileserver',
      },
    };
    service.spec = {
      ports: [
        {
          name: '80-80',
          port: 80,
          protocol: 'TCP',
          targetPort: 80,
        },
      ],
      selector: {
        service: 'http-fileserver',
      },
      type: 'LoadBalancer',
    };
    await kubeClient.createNamespacedService(namespace, service);
  }
}
export default KubernetesLogService;
