import { CoreV1Api, KubeConfig } from '@kubernetes/client-node';
import CloudRunnerLogger from '../../services/cloud-runner-logger';
import * as core from '@actions/core';
import waitUntil from 'async-wait-until';
import { FollowLogStreamService } from '../../services/follow-log-stream-service';
import { CloudRunnerSystem } from '../../services/cloud-runner-system';
import CloudRunner from '../../cloud-runner';

class KubernetesTaskRunner {
  static lastReceivedTimestamp: number;
  static lastReceivedMessage: string = ``;
  static async runTask(
    kubeConfig: KubeConfig,
    kubeClient: CoreV1Api,
    jobName: string,
    podName: string,
    containerName: string,
    namespace: string,
    alreadyFinished: boolean = false,
  ) {
    CloudRunnerLogger.log(
      `Streaming logs from pod: ${podName} container: ${containerName} namespace: ${namespace} finished ${alreadyFinished}`,
    );
    let output = '';
    let didStreamAnyLogs: boolean = false;
    let shouldReadLogs = true;
    let shouldCleanup = true;

    try {
      const sinceTime = KubernetesTaskRunner.lastReceivedTimestamp
        ? `--since-time="${new Date(KubernetesTaskRunner.lastReceivedTimestamp + 1).toISOString()}" `
        : ` `;
      let started = false;

      // using this instead of Kube
      const logs = await CloudRunnerSystem.Run(
        `kubectl logs ${podName} -f -c ${containerName} --timestamps ${sinceTime}`,
        false,
        true,
      );
      const splitLogs = logs.split(`\n`);
      for (const element of splitLogs) {
        didStreamAnyLogs = true;
        const chunk = element;
        const dateString = `${chunk.toString().split(`Z `)[0]}Z`;
        const newDate = Date.parse(dateString);
        new Date(newDate).toISOString();
        if (
          splitLogs[splitLogs.length - 1] !== KubernetesTaskRunner.lastReceivedMessage ||
          KubernetesTaskRunner.lastReceivedTimestamp < newDate
        ) {
          started = true;
        }
        if (!started) {
          continue;
        }
        const message = CloudRunner.buildParameters.cloudRunnerDebug ? chunk : chunk.split(`Z `)[1];
        KubernetesTaskRunner.lastReceivedTimestamp = newDate;
        ({ shouldReadLogs, shouldCleanup, output } = FollowLogStreamService.handleIteration(
          message,
          shouldReadLogs,
          shouldCleanup,
          output,
        ));
      }
      KubernetesTaskRunner.lastReceivedMessage = splitLogs[splitLogs.length - 1];

      if (!didStreamAnyLogs) {
        core.error('Failed to stream any logs, listing namespace events, check for an error with the container');
        core.error(
          JSON.stringify(
            {
              events: (await kubeClient.listNamespacedEvent(namespace)).body.items
                .filter((x) => {
                  return x.involvedObject.name === podName || x.involvedObject.name === jobName;
                })
                .map((x) => {
                  return {
                    type: x.involvedObject.kind,
                    name: x.involvedObject.name,
                    message: x.message,
                  };
                }),
            },
            undefined,
            4,
          ),
        );
        throw new Error(`No logs streamed from k8s`);
      }
      CloudRunnerLogger.log('end of log stream');
    } catch (error: any) {
      CloudRunnerLogger.log(`k8s stream watching failed ${JSON.stringify(error, undefined, 4)}`);
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
