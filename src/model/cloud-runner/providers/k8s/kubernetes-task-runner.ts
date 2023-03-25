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
  ) {
    const lastReceivedMessage =
      this.lastReceivedMessage !== ``
        ? `\nLast Log Message "${this.lastReceivedMessage}" ${this.lastReceivedTimestamp}`
        : ``;
    CloudRunnerLogger.log(
      `Streaming logs from pod: ${podName} container: ${containerName} namespace: ${namespace} ${CloudRunner.buildParameters.kubeVolumeSize}/${CloudRunner.buildParameters.containerCpu}/${CloudRunner.buildParameters.containerMemory}\n${lastReceivedMessage}`,
    );
    let output = '';
    let didStreamAnyLogs: boolean = false;
    let shouldReadLogs = true;
    let shouldCleanup = true;

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let sinceTime = ``;
        if (`${KubernetesTaskRunner.lastReceivedTimestamp}` !== ``) {
          const currentDate = new Date(KubernetesTaskRunner.lastReceivedTimestamp);
          const dateTimeIsoString = currentDate.toISOString();

          // k8s compatible iso date format - split by dot - https://www.googlecloudcommunity.com/gc/Apigee/JS-for-current-timestamp-in-W3C-WSDL-date-format-YYYY-MM-DDThh/td-p/68415
          const currentDateTime = dateTimeIsoString.split('.')[0];
          const timeZoneOffset = currentDate.getTimezoneOffset();
          const positiveOffset = Math.abs(timeZoneOffset);
          const timeOffsetInHours = -(timeZoneOffset / 60);
          const minZone = positiveOffset - Math.floor(timeOffsetInHours) * 60;
          const symbolOffset = timeZoneOffset > 0 ? '-' : '+';
          const hourOffset = Math.floor(timeOffsetInHours) < 10 ? 0 : '';
          const minOffset = minZone < 10 ? 0 : '';
          const tzd = `${symbolOffset + hourOffset + Math.floor(timeOffsetInHours)}:${minOffset}${minZone}`;
          const dateTZDformat = currentDateTime + tzd;
          sinceTime = ` --since-time="${dateTZDformat}"`;
        }
        let lastMessageSeenIncludedInChunk = false;
        let lastMessageSeen = false;

        // using this instead of Kube
        const logs = await CloudRunnerSystem.Run(
          `kubectl logs ${podName} -f -c ${containerName} --timestamps${sinceTime}`,
          false,
          true,
        );
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
          didStreamAnyLogs = true;
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
        if (FollowLogStreamService.DidReceiveEndOfTransmission) {
          CloudRunnerLogger.log('end of log stream');
          break;
        }
      }
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
