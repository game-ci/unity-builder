import { CoreV1Api, KubeConfig, Log } from '@kubernetes/client-node';
import { Writable } from 'stream';
import CloudRunnerLogger from '../services/cloud-runner-logger';
import { CloudRunnerState } from '../state/cloud-runner-state';
import * as core from '@actions/core';
import fs from 'fs';
import { CloudRunnerStatics } from '../cloud-runner-statics';
import waitUntil from 'async-wait-until';

class KubernetesTaskRunner {
  static async runTask(
    kubeConfig: KubeConfig,
    kubeClient: CoreV1Api,
    jobName: string,
    podName: string,
    containerName: string,
    namespace: string,
    logCallback: any,
  ) {
    CloudRunnerLogger.log(`Streaming logs from pod: ${podName} container: ${containerName} namespace: ${namespace}`);
    const stream = new Writable();
    let didStreamAnyLogs: boolean = false;
    stream._write = (chunk, encoding, next) => {
      didStreamAnyLogs = true;
      let message = chunk.toString();
      message = `[${CloudRunnerStatics.logPrefix}] ${message}`;
      if (CloudRunnerState.buildParams.logToFile) {
        fs.appendFileSync(`${CloudRunnerState.buildGuid}-outputfile.txt`, `${message}\n`);
      }
      logCallback(message);
      next();
    };
    const logOptions = {
      follow: true,
      pretty: false,
      previous: false,
    };
    try {
      const resultError = await new Promise(async (resolve) =>
        new Log(kubeConfig).log(namespace, podName, containerName, stream, resolve, logOptions),
      );
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
      throw error;
    }
    CloudRunnerLogger.log('end of log stream');
  }

  static async watchUntilPodRunning(kubeClient: CoreV1Api, podName: string, namespace: string) {
    let success: boolean = false;
    CloudRunnerLogger.log(`Watching ${podName} ${namespace}`);
    await waitUntil(
      async () => {
        const status = await kubeClient.readNamespacedPodStatus(podName, namespace);
        const phase = status?.body.status?.phase;
        success = phase === 'Running';
        CloudRunnerLogger.log(`${status.body.status?.phase} ${status.body.status?.conditions?.[0].message}`);
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

export default KubernetesTaskRunner;