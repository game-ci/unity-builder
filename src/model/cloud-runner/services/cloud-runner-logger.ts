import * as core from '@actions/core';

class CloudRunnerLogger {
  private static timestamp: number;
  private static globalTimestamp: number;
  private static readonly logsFile: string = process.env.GCP_LOG_FILE || '';
  static logger: any;

  public static setup() {
    this.timestamp = this.createTimestamp();
    this.globalTimestamp = this.timestamp;
  }

  public static log(message: string) {
    core.info(message);
    if (process.env.GCP_LOGGING) {
      CloudRunnerLogger.writeGCPLog(`${message}\n`);
    }
  }

  public static logWarning(message: string) {
    core.warning(message);
    if (process.env.GCP_LOGGING) {
      CloudRunnerLogger.writeGCPLog(`${message}\n`);
    }
  }

  public static logLine(message: string) {
    core.info(`${message}\n`);
    if (process.env.GCP_LOGGING) {
      CloudRunnerLogger.writeGCPLog(`${message}\n`);
    }
  }

  public static error(message: string) {
    core.error(message);
    if (process.env.GCP_LOGGING) {
      CloudRunnerLogger.writeGCPLog(`${message}\n`);
    }
  }

  public static logWithTime(message: string) {
    const newTimestamp = this.createTimestamp();
    core.info(
      `${message} (Since previous: ${this.calculateTimeDiff(
        newTimestamp,
        this.timestamp,
      )}, Total time: ${this.calculateTimeDiff(newTimestamp, this.globalTimestamp)})`,
    );
    this.timestamp = newTimestamp;
  }

  private static calculateTimeDiff(x: number, y: number) {
    return Math.floor((x - y) / 1000);
  }

  private static createTimestamp() {
    return Date.now();
  }

  public static async writeGCPLog(text) {
    if (!CloudRunnerLogger.logger) {
      this.SetupGoogleLogs();
    }
    const metadata = {
      resource: { type: 'global' },
      severity: 'INFO',
    };
    const entry = CloudRunnerLogger.logger.entry(metadata, text);
    await CloudRunnerLogger.logger.write(entry);
  }

  private static SetupGoogleLogs() {
    const logging = new Logging({ projectId: process.env.GCP_PROJECT });
    CloudRunnerLogger.logger = logging.log('game-ci');
  }
}
let Logging;
if (process.env.GCP_LOGGING) {
  Logging = require('@google-cloud/logging');
}
export default CloudRunnerLogger;
