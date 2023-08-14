import CloudRunnerLogger from '../services/core/cloud-runner-logger';
import fs from 'node:fs';
import path from 'node:path';
import CloudRunner from '../cloud-runner';
import CloudRunnerOptions from '../options/cloud-runner-options';
import { CloudRunnerSystem } from '../services/core/cloud-runner-system';
import { CloudRunnerFolders } from '../options/cloud-runner-folders';

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

  public static async handleLogManagementPostJob() {
    if (CloudRunnerOptions.providerStrategy !== 'k8s') {
      return;
    }
    CloudRunnerLogger.log(`Collected Logs`);
    let hashedLogs = fs.readFileSync(RemoteClientLogger.LogFilePath).toString();

    // create hashed version of logs using md5sum
    const startPath = process.cwd();
    process.chdir(path.resolve(CloudRunnerFolders.repoPathAbsolute, '..'));
    hashedLogs = await await CloudRunnerSystem.Run(`md5sum ${RemoteClientLogger.LogFilePath}`);
    process.chdir(startPath);

    CloudRunnerLogger.log(hashedLogs);
    const logs = fs.readFileSync(RemoteClientLogger.LogFilePath).toString();
    CloudRunnerLogger.log(logs);

    // loop for 5 mins logging the logs every minute
    for (let index = 0; index < 5; index++) {
      await new Promise((resolve) => setTimeout(resolve, 60000));
      CloudRunnerLogger.log(logs);
    }
  }
}
