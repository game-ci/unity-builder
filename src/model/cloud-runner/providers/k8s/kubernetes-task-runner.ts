import { CoreV1Api, KubeConfig, Log } from '@kubernetes/client-node';
import { Writable } from 'stream';
import CloudRunnerLogger from '../../services/cloud-runner-logger';
import * as core from '@actions/core';
import { CloudRunnerStatics } from '../../cloud-runner-statics';
import waitUntil from 'async-wait-until';
import { FollowLogStreamService } from '../../services/follow-log-stream-service';

class KubernetesTaskRunner {
  static lastReceivedTimestamp: number;
  static async runTask(
    kubeConfig: KubeConfig,
    kubeClient: CoreV1Api,
    jobName: string,
    podName: string,
    containerName: string,
    namespace: string,
  ) {
    CloudRunnerLogger.log(`Streaming logs from pod: ${podName} container: ${containerName} namespace: ${namespace}`);
    const stream = new Writable();
    let output = '';
    let didStreamAnyLogs: boolean = false;
    let shouldReadLogs = true;
    let shouldCleanup = true;
    stream._write = (chunk, encoding, next) => {
      didStreamAnyLogs = true;
      let message = chunk.toString().trimRight(`\n`);
      message = `[${CloudRunnerStatics.logPrefix}] ${message}`;
      ({ shouldReadLogs, shouldCleanup, output } = FollowLogStreamService.handleIteration(
        message,
        shouldReadLogs,
        shouldCleanup,
        output,
      ));
      next();
    };

    // export interface LogOptions {
    /**
     * Follow the log stream of the pod. Defaults to false.
     */
    // follow?: boolean;
    /**
     * If set, the number of bytes to read from the server before terminating the log output. This may not display a
     * complete final line of logging, and may return slightly more or slightly less than the specified limit.
     */
    // limitBytes?: number;
    /**
     * If true, then the output is pretty printed.
     */
    // pretty?: boolean;
    /**
     * Return previous terminated container logs. Defaults to false.
     */
    // previous?: boolean;
    /**
     * A relative time in seconds before the current time from which to show logs. If this value precedes the time a
     * pod was started, only logs since the pod start will be returned. If this value is in the future, no logs will
     * be returned. Only one of sinceSeconds or sinceTime may be specified.
     */
    // sinceSeconds?: number;
    /**
     * If set, the number of lines from the end of the logs to show. If not specified, logs are shown from the creation
     * of the container or sinceSeconds or sinceTime
     */
    // tailLines?: number;
    /**
     * If true, add an RFC3339 or RFC3339Nano timestamp at the beginning of every line of log output. Defaults to false.
     */
    // timestamps?: boolean;
    // }

    const logOptions = {
      follow: true,
      pretty: false,
      previous: true,
      timestamps: true,
      sinceSeconds: KubernetesTaskRunner.lastReceivedTimestamp,
    };
    try {
      const resultError = await new Log(kubeConfig).log(namespace, podName, containerName, stream, logOptions);
      stream.destroy();
      if (resultError) {
        throw resultError;
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
    } catch (error) {
      if (stream) {
        stream.destroy();
      }
      CloudRunnerLogger.log(JSON.stringify(error));
      CloudRunnerLogger.log('k8s task runner failed');
      throw error;
    }
    CloudRunnerLogger.log('end of log stream');

    return output;
  }

  static async watchUntilPodRunning(kubeClient: CoreV1Api, podName: string, namespace: string) {
    let success: boolean = false;
    CloudRunnerLogger.log(`Watching ${podName} ${namespace}`);
    await waitUntil(
      async () => {
        const status = await kubeClient.readNamespacedPodStatus(podName, namespace);
        const phase = status?.body.status?.phase;
        success = phase === 'Running';
        CloudRunnerLogger.log(
          `${status.body.status?.phase} ${status.body.status?.conditions?.[0].reason || ''} ${
            status.body.status?.conditions?.[0].message || ''
          }`,
        );
        if (success || phase !== 'Pending') return true;

        return false;
      },
      {
        timeout: 2000000,
        intervalBetweenAttempts: 15000,
      },
    );

    return success;
  }
}

export default KubernetesTaskRunner;
