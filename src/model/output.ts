import * as core from '@actions/core';

class Output {
  static async setBuildVersion(buildVersion: string) {
    core.setOutput('buildVersion', buildVersion);
  }

  static async setAndroidVersionCode(androidVersionCode: string) {
    core.setOutput('androidVersionCode', androidVersionCode);
  }
}

export default Output;
