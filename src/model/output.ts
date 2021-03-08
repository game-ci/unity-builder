const core = require('@actions/core');

class Output {
  static async setBuildVersion(buildVersion) {
    await core.setOutput('buildVersion', buildVersion);
  }
}

export default Output;
