import { CoreV1Api } from '@kubernetes/client-node';
import * as k8s from '@kubernetes/client-node';
import CloudRunnerLogger from '../../services/core/cloud-runner-logger';
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
    // json
    /*
    apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  creationTimestamp: null
  labels:
    service: http-fileserver
  name: http-fileserver
spec:
  replicas: 1
  strategy: {}
  template:
    metadata:
      creationTimestamp: null
      labels:
        service: http-fileserver
    spec:
      containers:
      - image: pgaertig/nginx-big-upload:latest
        imagePullPolicy: Always
        name: http-fileserver
        resources: {}
      restartPolicy: Always
status: {}
    */
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
              image: 'pgaertig/nginx-big-upload:latest',
              imagePullPolicy: 'Always',
              name: 'http-fileserver',
              resources: {},
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

      // get ip address of service
      const service = await kubeClientCore.readNamespacedService('http-fileserver', namespace);

      // log service json
      CloudRunnerLogger.log(`Service: ${JSON.stringify(service.body)}`);
      const ip = service.body.status?.loadBalancer?.ingress?.[0]?.ip;
      if (ip && ip.length > 0) {
        return ip;
      }
    }
  }

  // create kubernetes service to expose deployment
  static async createLogServiceExpose(namespace: string, kubeClient: CoreV1Api) {
    // json
    /*
    apiVersion: v1
    kind: Service
    metadata:
    creationTimestamp: null
    labels:
      service: http-fileserver
    name: http-fileserver
    spec:
      ports:
      - name: 80-80
        port: 80
        protocol: TCP
        targetPort: 80
      selector:
        service: http-fileserver
      type: LoadBalancer
    status:
      loadBalancer: {}
    */
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
