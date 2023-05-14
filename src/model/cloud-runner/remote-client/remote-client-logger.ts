import path from 'node:path';
import { CloudRunnerFolders } from '../options/cloud-runner-folders';
import CloudRunnerLogger from '../services/core/cloud-runner-logger';
import fs from 'node:fs';

export class RemoteClientLogger {
  private static get LogFilePath() {
    return path.join(CloudRunnerFolders.uniqueCloudRunnerJobFolderAbsolute, `job-log.txt`);
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
    fs.appendFileSync(RemoteClientLogger.LogFilePath, message);
  }

  public static printCollectedLogs() {
    CloudRunnerLogger.log(`Collected Logs`);
    CloudRunnerLogger.log(fs.readFileSync(RemoteClientLogger.LogFilePath).toString());
  }
}
