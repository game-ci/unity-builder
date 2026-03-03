import CloudRunnerLogger from '../services/core/cloud-runner-logger';
import fs from 'node:fs';
import path from 'node:path';
import CloudRunner from '../cloud-runner';
import CloudRunnerOptions from '../options/cloud-runner-options';

export class RemoteClientLogger {
  private static get LogFilePath() {
    // Use a cross-platform temporary directory for local development
    if (process.platform === 'win32') {
      return path.join(process.cwd(), 'temp', 'job-log.txt');
    }

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
      // Ensure the directory exists before writing
      const logDirectory = path.dirname(RemoteClientLogger.LogFilePath);
      if (!fs.existsSync(logDirectory)) {
        fs.mkdirSync(logDirectory, { recursive: true });
      }

      fs.appendFileSync(RemoteClientLogger.LogFilePath, `${message}\n`);
    }
  }

  public static async handleLogManagementPostJob() {
    if (CloudRunnerOptions.providerStrategy !== 'k8s') {
      return;
    }
    const collectedLogsMessage = `Collected Logs`;

    // Write to log file first so it's captured even if kubectl has issues
    // This ensures the message is available in BuildResults when logs are read from the file
    RemoteClientLogger.appendToFile(collectedLogsMessage);

    // For K8s, write to stdout/stderr so kubectl logs can capture it
    // This is critical because kubectl logs reads from stdout/stderr, not from GitHub Actions logs
    // Write multiple times to increase chance of capture if kubectl is having issues
    if (CloudRunnerOptions.providerStrategy === 'k8s') {
      // Write to stdout multiple times to increase chance of capture
      for (let index = 0; index < 3; index++) {
        process.stdout.write(`${collectedLogsMessage}\n`, 'utf8');
        process.stderr.write(`${collectedLogsMessage}\n`, 'utf8');
      }

      // Ensure stdout/stderr are flushed
      if (!process.stdout.isTTY) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    // Also log via CloudRunnerLogger for GitHub Actions
    CloudRunnerLogger.log(collectedLogsMessage);

    // check for log file not existing
    if (!fs.existsSync(RemoteClientLogger.LogFilePath)) {
      const logFileMissingMessage = `Log file does not exist`;
      if (CloudRunnerOptions.providerStrategy === 'k8s') {
        process.stdout.write(`${logFileMissingMessage}\n`, 'utf8');
      }
      CloudRunnerLogger.log(logFileMissingMessage);

      // check if CloudRunner.isCloudRunnerEnvironment is true, log
      if (!CloudRunner.isCloudRunnerEnvironment) {
        const notCloudEnvironmentMessage = `Cloud Runner is not running in a cloud environment, not collecting logs`;
        if (CloudRunnerOptions.providerStrategy === 'k8s') {
          process.stdout.write(`${notCloudEnvironmentMessage}\n`, 'utf8');
        }
        CloudRunnerLogger.log(notCloudEnvironmentMessage);
      }

      return;
    }
    const logFileExistsMessage = `Log file exist`;
    if (CloudRunnerOptions.providerStrategy === 'k8s') {
      process.stdout.write(`${logFileExistsMessage}\n`, 'utf8');
    }
    CloudRunnerLogger.log(logFileExistsMessage);
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
