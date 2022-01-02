import * as core from '@actions/core';
import { ChildProcess, exec } from 'child_process';
import { Input } from '../..';
import fs from 'fs';
import path from 'path';

class CloudRunnerLogger {
  private static timestamp: number;
  private static globalTimestamp: number;
  private static readonly logsFile: string = path.join('/', 'cloud-runner-logs');

  public static setup() {
    this.timestamp = this.createTimestamp();
    this.globalTimestamp = this.timestamp;
  }

  public static log(message: string) {
    core.info(message);
    fs.appendFile('cloud-runner-logs', message, () => {});
  }

  public static logWarning(message: string) {
    core.warning(message);
    fs.appendFile('cloud-runner-logs', message, () => {});
  }

  public static logLine(message: string) {
    core.info(`${message}\n`);
    fs.appendFile('cloud-runner-logs', message, () => {});
  }

  public static error(message: string) {
    core.error(message);
    fs.appendFile('cloud-runner-logs', message, () => {});
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
    CloudRunnerLogger.log(`STARTING INIT HOOK ${process.env.INIT_HOOK}`);
    CloudRunnerLogger.child = exec(process.env.INIT_HOOK, (error: any, stdout: string, stderr: any) => {
      if (error) {
        CloudRunnerLogger.error(`[GCP-LOGGER][ERROR]${error}`);
        return;
      }
      if (stderr) {
        CloudRunnerLogger.logWarning(`[GCP-LOGGER][DIAGNOSTIC]${stderr}`);
        return;
      }
      CloudRunnerLogger.log(`[GCP-LOGGER]${stdout}`);
    });
    CloudRunnerLogger.child.on('close', function (code) {
      CloudRunnerLogger.log(`[GCP-LOGGER][Exit code ${code}]`);
      if (code !== 0) {
        throw new Error(`${code}`);
      }
    });
  }
  public static Shutdown() {
    CloudRunnerLogger.child.kill(0);
  }
  private static child: ChildProcess;
}
export default CloudRunnerLogger;
