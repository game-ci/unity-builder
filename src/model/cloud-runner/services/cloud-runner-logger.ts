import * as core from '@actions/core';
import { ChildProcess, spawn } from 'child_process';
import { Input } from '../..';
import fs from 'fs';

class CloudRunnerLogger {
  private static timestamp: number;
  private static globalTimestamp: number;
  private static readonly logsFile: string = process.env.GCP_LOG_FILE || '';

  public static setup() {
    this.timestamp = this.createTimestamp();
    this.globalTimestamp = this.timestamp;
  }

  public static log(message: string) {
    core.info(message);
    if (process.env.GCP_LOGGING) {
      fs.appendFile(CloudRunnerLogger.logsFile, `${message}\n`, () => {});
    }
  }

  public static logWarning(message: string) {
    core.warning(message);
    if (process.env.GCP_LOGGING) {
      fs.appendFile(CloudRunnerLogger.logsFile, `${message}\n`, () => {});
    }
  }

  public static logLine(message: string) {
    core.info(`${message}\n`);
    if (process.env.GCP_LOGGING) {
      fs.appendFile(CloudRunnerLogger.logsFile, `${message}\n`, () => {});
    }
  }

  public static error(message: string) {
    core.error(message);
    if (process.env.GCP_LOGGING) {
      fs.appendFile(CloudRunnerLogger.logsFile, `${message}\n`, () => {});
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

  public static InitHook() {
    if (process.env.INIT_HOOK === undefined || !Input.cloudRunnerTests) {
      return;
    }
    CloudRunnerLogger.log(`STARTING INIT HOOK ${process.env.INIT_HOOK}`);
    CloudRunnerLogger.child = spawn(process.env.INIT_HOOK);

    CloudRunnerLogger.child?.stdout?.on('data', (data) => {
      CloudRunnerLogger.log(`[GCP-LOGGER]${data}`);
    });

    CloudRunnerLogger.child?.stderr?.on('data', (data) => {
      CloudRunnerLogger.logWarning(`[GCP-LOGGER][DIAGNOSTIC]${data}`);
    });

    CloudRunnerLogger.child?.on('error', (data) => {
      CloudRunnerLogger.error(`[GCP-LOGGER][ERROR]${data}`);
    });

    CloudRunnerLogger.child.on('close', function (code) {
      CloudRunnerLogger.log(`[GCP-LOGGER][Exit code ${code}]`);
      if (code !== 0) {
        throw new Error(`${code}`);
      }
    });
  }
  public static Shutdown() {
    if (CloudRunnerLogger.child) {
      CloudRunnerLogger.child.kill(0);
    }
  }
  private static child: ChildProcess;
}
export default CloudRunnerLogger;
