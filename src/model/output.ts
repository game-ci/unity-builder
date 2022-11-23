const core = require('@actions/core');

class Output {
  static async setBuildVersion(buildVersion) {
    await core.setOutput('buildVersion', buildVersion);
  }

  static async setAndroidVersionCode(androidVersionCode) {
    await core.setOutput('androidVersionCode', androidVersionCode);
  }
}

export default Output;
