import { CoreV1Api, KubeConfig, Log } from '@kubernetes/client-node';
import { Writable } from 'stream';
import CloudRunnerLogger from '../services/cloud-runner-logger';
import { CloudRunnerState } from '../state/cloud-runner-state';
import fs from 'fs';
import { CloudRunnerStatics } from '../cloud-runner-statics';

class KubernetesLogging {
  static async streamLogs(
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
        throw new Error(
          JSON.stringify(
            {
              message: 'Failed to stream any logs, listing namespace events, check for an error with the container',
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
      }
    } catch (error) {
      throw error;
    }
    CloudRunnerLogger.log('end of log stream');
  }
}

export default KubernetesLogging;
