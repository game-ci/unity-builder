import * as core from '@actions/core';
const { Logging } = process.env.GCP_LOGGING ? require('@google-cloud/logging') : { Logging: process.env.GCP_LOGGING };

class CloudRunnerLogger {
  private static timestamp: number;
  private static globalTimestamp: number;

  public static setup() {
    this.timestamp = this.createTimestamp();
    this.globalTimestamp = this.timestamp;
  }

  public static log(message: string) {
    this.logToGoogle(message);
    core.info(message);
  }

  public static logWarning(message: string) {
    this.logToGoogle(message);
    core.warning(message);
  }

  public static logLine(message: string) {
    this.logToGoogle(message);
    core.info(`${message}\n`);
  }

  public static error(message: string) {
    this.logToGoogle(message);
    core.error(message);
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

  private static logToGoogle(message: string) {
    const projectId = process.env.GCP_PROJECT;
    const logName = process.env.GCP_LOG_NAME;
    // GCP only setup as dev dependency
    if (!process.env.GCP_LOGGING) {
      return;
    }

    // Creates a client
    const logging = new Logging({ projectId });

    // Selects the log to write to
    const log = logging.log(logName);

    // The data to write to the log
    const text = message;

    // The metadata associated with the entry
    const metadata = {
      resource: { type: 'global' },
      // See: https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#logseverity
      severity: 'INFO',
    };

    // Prepares a log entry
    const entry = log.entry(metadata, text);

    async function writeLog() {
      // Writes the log entry
      await log.write(entry);
    }
    writeLog();
  }
}
export default CloudRunnerLogger;
