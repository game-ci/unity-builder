import CloudRunnerLogger from '../services/core/cloud-runner-logger';
import fs from 'node:fs';
import path from 'node:path';
import CloudRunner from '../cloud-runner';
import CloudRunnerOptions from '../options/cloud-runner-options';

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

    // check for log file not existing
    if (!fs.existsSync(RemoteClientLogger.LogFilePath)) {
      CloudRunnerLogger.log(`Log file does not exist`);

      // check if CloudRunner.isCloudRunnerEnvironment is true, log
      if (!CloudRunner.isCloudRunnerEnvironment) {
        CloudRunnerLogger.log(`Cloud Runner is not running in a cloud environment, not collecting logs`);
      }

      return;
    }
    CloudRunnerLogger.log(`Log file exist`);
    await new Promise((resolve) => setTimeout(resolve, 1));

    // let hashedLogs = fs.readFileSync(RemoteClientLogger.LogFilePath).toString();
    //
    // hashedLogs = md5(hashedLogs);
    //
    // for (let index = 0; index < 3; index++) {
    //   CloudRunnerLogger.log(`LOGHASH: ${hashedLogs}`);
    //   const logs = fs.readFileSync(RemoteClientLogger.LogFilePath).toString();
    //   CloudRunnerLogger.log(`LOGS: ${Buffer.from(logs).toString('base64')}`);
    //   CloudRunnerLogger.log(
    //     `Game CI's "Cloud Runner System" will cancel the log when it has successfully received the log data to verify all logs have been received.`,
    //   );
    //
    //   // wait for 15 seconds to allow the log to be sent
    //   await new Promise((resolve) => setTimeout(resolve, 15000));
    // }
  }
  public static HandleLog(message: string): boolean {
    if (RemoteClientLogger.value !== '') {
      RemoteClientLogger.value += `\n`;
    }

    RemoteClientLogger.value += message;

    return false;
  }
  static value: string = '';
}
