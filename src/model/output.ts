import { core } from '../dependencies.ts';

class Output {
  static async setBuildVersion(buildVersion) {
    await core.setOutput('buildVersion', buildVersion);
  }
}

export default Output;
