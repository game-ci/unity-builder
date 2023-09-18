import { CoreV1Api, KubeConfig } from '@kubernetes/client-node';
import CloudRunnerLogger from '../../services/core/cloud-runner-logger';
import waitUntil from 'async-wait-until';
import { CloudRunnerSystem } from '../../services/core/cloud-runner-system';
import CloudRunner from '../../cloud-runner';
import KubernetesPods from './kubernetes-pods';
import { FollowLogStreamService } from '../../services/core/follow-log-stream-service';
import { RemoteClientLogger } from '../../remote-client/remote-client-logger';

class KubernetesTaskRunner {
  static readonly maxRetry: number = 3;
  static async runTask(
    kubeConfig: KubeConfig,
    kubeClient: CoreV1Api,
    jobName: string,
    podName: string,
    containerName: string,
    namespace: string,
  ) {
    let output = '';
    let shouldReadLogs = true;
    let shouldCleanup = true;
    let retriesAfterFinish = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      CloudRunnerLogger.log(
        `Streaming logs from pod: ${podName} container: ${containerName} namespace: ${namespace} ${CloudRunner.buildParameters.kubeVolumeSize}/${CloudRunner.buildParameters.containerCpu}/${CloudRunner.buildParameters.containerMemory}`,
      );
      let extraFlags = ``;
      extraFlags += (await KubernetesPods.IsPodRunning(podName, namespace, kubeClient))
        ? ` -f -c ${containerName}`
        : ` --previous`;

      let logs;
      const callback = (outputChunk: string) => {
        output += outputChunk;

        // check if log start included in logs if so log a message
        if (outputChunk.includes(`log start`)) {
          CloudRunnerLogger.log(`Log Start found in logs`);
        }
      };
      try {
        logs = await CloudRunnerSystem.Run(`kubectl logs ${podName}${extraFlags}`, false, true, callback);
      } catch (error: any) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const continueStreaming = await KubernetesPods.IsPodRunning(podName, namespace, kubeClient);
        CloudRunnerLogger.log(`K8s logging error ${error} ${continueStreaming}`);
        if (continueStreaming) {
          continue;
        }
        if (retriesAfterFinish < KubernetesTaskRunner.maxRetry) {
          retriesAfterFinish++;

          continue;
        }
        throw error;
      }
      const splitLogs = logs.split(`\n`);
      for (const chunk of splitLogs) {
        const message = CloudRunner.buildParameters.cloudRunnerDebug ? chunk : chunk.split(`Z `)[1];
        ({ shouldReadLogs, shouldCleanup, output } = FollowLogStreamService.handleIteration(
          message,
          shouldReadLogs,
          shouldCleanup,
          output,
        ));
        FollowLogStreamService.DidReceiveEndOfTransmission = RemoteClientLogger.HandleLogChunkLine(message);
      }
      if (FollowLogStreamService.DidReceiveEndOfTransmission) {
        CloudRunnerLogger.log('end of log stream');
        break;
      }
    }

    return output;
  }

  static async watchUntilPodRunning(kubeClient: CoreV1Api, podName: string, namespace: string) {
    let waitComplete: boolean = false;
    let message = ``;
    CloudRunnerLogger.log(`Watching ${podName} ${namespace}`);
    await waitUntil(
      async () => {
        const status = await kubeClient.readNamespacedPodStatus(podName, namespace);
        const phase = status?.body.status?.phase;
        waitComplete = phase !== 'Pending';
        message = `Phase:${status.body.status?.phase} \n Reason:${
          status.body.status?.conditions?.[0].reason || ''
        } \n Message:${status.body.status?.conditions?.[0].message || ''}`;

        // CloudRunnerLogger.log(
        //   JSON.stringify(
        //     (await kubeClient.listNamespacedEvent(namespace)).body.items
        //       .map((x) => {
        //         return {
        //           message: x.message || ``,
        //           name: x.metadata.name || ``,
        //           reason: x.reason || ``,
        //         };
        //       })
        //       .filter((x) => x.name.includes(podName)),
        //     undefined,
        //     4,
        //   ),
        // );
        if (waitComplete || phase !== 'Pending') return true;

        return false;
      },
      {
        timeout: 2000000,
        intervalBetweenAttempts: 15000,
      },
    );
    if (!waitComplete) {
      CloudRunnerLogger.log(message);
    }

    return waitComplete;
  }
}

export default KubernetesTaskRunner;
