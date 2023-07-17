import CloudRunnerLogger from '../services/core/cloud-runner-logger';
import fs from 'node:fs';
import path from 'node:path';
import CloudRunner from '../cloud-runner';
import CloudRunnerOptions from '../options/cloud-runner-options';
import Kubernetes from '../providers/k8s';

export class RemoteClientLogger {
  private static get LogFilePath() {
    return path.join(`/home`, `job-log.txt`);
  }

  public static log(message: string) {
    const finalMessage = `[Client] ${message}`;
    this.appendToFile(finalMessage);
    CloudRunnerLogger.log(finalMessage);
  }

  public static logCliError(message: string) {
    CloudRunnerLogger.log(`[Client][Error] ${message}`);
  }

  public static logCliDiagnostic(message: string) {
    CloudRunnerLogger.log(`[Client][Diagnostic] ${message}`);
  }

  public static logWarning(message: string) {
    CloudRunnerLogger.logWarning(message);
  }

  public static appendToFile(message: string) {
    if (CloudRunner.isCloudRunnerEnvironment) {
      fs.appendFileSync(RemoteClientLogger.LogFilePath, `${message}\n`);
    }
  }

  public static async printCollectedLogs() {
    if (CloudRunnerOptions.providerStrategy !== 'k8s') {
      return;
    }
    CloudRunnerLogger.log(`Collected Logs`);
    CloudRunnerLogger.log(process.env[`LOG_SERVICE_IP`] || ``);
    const logs = fs.readFileSync(RemoteClientLogger.LogFilePath).toString();
    CloudRunnerLogger.log(logs);
    await Kubernetes.Instance.PushLogUpdate(logs);
  }
}
