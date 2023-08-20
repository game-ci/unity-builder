import { CoreV1Api, KubeConfig } from '@kubernetes/client-node';
import CloudRunnerLogger from '../../services/core/cloud-runner-logger';
import { waitUntil } from 'async-wait-until';
import { CloudRunnerSystem } from '../../services/core/cloud-runner-system';
import CloudRunner from '../../cloud-runner';
import KubernetesPods from './kubernetes-pods';
import { FollowLogStreamService } from '../../services/core/follow-log-stream-service';

class KubernetesTaskRunner {
  static lastReceivedTimestamp: number = 0;
  static readonly maxRetry: number = 3;
  static lastReceivedMessage: string = ``;

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
    let sinceTime = ``;
    let retriesAfterFinish = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const lastReceivedMessage =
        KubernetesTaskRunner.lastReceivedTimestamp > 0
          ? `\nLast Log Message "${this.lastReceivedMessage}" ${this.lastReceivedTimestamp}`
          : ``;
      CloudRunnerLogger.log(
        `Streaming logs from pod: ${podName} container: ${containerName} namespace: ${namespace} ${CloudRunner.buildParameters.kubeVolumeSize}/${CloudRunner.buildParameters.containerCpu}/${CloudRunner.buildParameters.containerMemory}\n${lastReceivedMessage}`,
      );
      if (KubernetesTaskRunner.lastReceivedTimestamp > 0) {
        const currentDate = new Date(KubernetesTaskRunner.lastReceivedTimestamp);
        const dateTimeIsoString = currentDate.toISOString();
        sinceTime = ` --since-time="${dateTimeIsoString}"`;
      }
      let extraFlags = ``;
      extraFlags += (await KubernetesPods.IsPodRunning(podName, namespace, kubeClient))
        ? ` -f -c ${containerName}`
        : ` --previous`;
      let lastMessageSeenIncludedInChunk = false;
      let lastMessageSeen = false;

      let logs;

      try {
        logs = await CloudRunnerSystem.Run(
          `kubectl logs ${podName}${extraFlags} --timestamps${sinceTime}`,
          false,
          true,
        );
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
        if (
          chunk.replace(/\s/g, ``) === KubernetesTaskRunner.lastReceivedMessage.replace(/\s/g, ``) &&
          KubernetesTaskRunner.lastReceivedMessage.replace(/\s/g, ``) !== ``
        ) {
          CloudRunnerLogger.log(`Previous log message found ${chunk}`);
          lastMessageSeenIncludedInChunk = true;
        }
      }
      for (const chunk of splitLogs) {
        const newDate = Date.parse(`${chunk.toString().split(`Z `)[0]}Z`);
        if (chunk.replace(/\s/g, ``) === KubernetesTaskRunner.lastReceivedMessage.replace(/\s/g, ``)) {
          lastMessageSeen = true;
        }
        if (lastMessageSeenIncludedInChunk && !lastMessageSeen) {
          continue;
        }
        const message = CloudRunner.buildParameters.cloudRunnerDebug ? chunk : chunk.split(`Z `)[1];
        KubernetesTaskRunner.lastReceivedMessage = chunk;
        KubernetesTaskRunner.lastReceivedTimestamp = newDate;
        ({ shouldReadLogs, shouldCleanup, output } = FollowLogStreamService.handleIteration(
          message,
          shouldReadLogs,
          shouldCleanup,
          output,
        ));
      }
      if (FollowLogStreamService.DidReceiveEndOfTransmission) {
        CloudRunnerLogger.log('end of log stream');
        break;
      }
    }

    return output;
  }

  static async watchUntilPodRunning(kubeClient: CoreV1Api, podName: string, namespace: string) {
    let success: boolean = false;
    let message = ``;
    CloudRunnerLogger.log(`Watching ${podName} ${namespace}`);
    await waitUntil(
      async () => {
        const status = await kubeClient.readNamespacedPodStatus(podName, namespace);
        const phase = status?.body.status?.phase;
        success = phase === 'Running';
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
        if (success || phase !== 'Pending') return true;

        return false;
      },
      {
        timeout: 2000000,
        intervalBetweenAttempts: 15000,
      },
    );
    if (!success) {
      CloudRunnerLogger.log(message);
    }

    return success;
  }
}

export default KubernetesTaskRunner;
