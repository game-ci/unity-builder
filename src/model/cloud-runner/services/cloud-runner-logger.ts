import * as core from '@actions/core';
import { exec } from 'child_process';
import { Input } from '../..';

class CloudRunnerLogger {
  private static timestamp: number;
  private static globalTimestamp: number;

  public static setup() {
    this.timestamp = this.createTimestamp();
    this.globalTimestamp = this.timestamp;
  }

  public static log(message: string) {
    core.info(message);
  }

  public static logWarning(message: string) {
    core.warning(message);
  }

  public static logLine(message: string) {
    core.info(`${message}\n`);
  }

  public static error(message: string) {
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

  public static InitHook() {
    if (process.env.INIT_HOOK === undefined || !Input.cloudRunnerTests) {
      return;
    }
    CloudRunnerLogger.log(process.env.INIT_HOOK);
    exec(process.env.INIT_HOOK, (error: any, stdout: string, stderr: any) => {
      if (error) {
        CloudRunnerLogger.error(JSON.stringify(error));
        return;
      }
      if (stderr) {
        CloudRunnerLogger.logWarning(`[GCP-LOGGER]${stderr}`);
        return;
      }
      CloudRunnerLogger.log(stdout);
    });
  }
}
export default CloudRunnerLogger;
