import * as core from '@actions/core';

class Output {
  static async setBuildVersion(buildVersion: string) {
    core.setOutput('buildVersion', buildVersion);
  }

  static async setAndroidVersionCode(androidVersionCode: string) {
    core.setOutput('androidVersionCode', androidVersionCode);
  }

  static async setExitCode(exitCode: number) {
    core.setOutput('exitCode', exitCode);
  }
}

export default Output;
