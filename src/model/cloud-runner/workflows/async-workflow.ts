import CloudRunnerSecret from '../services/cloud-runner-secret';
import CloudRunnerEnvironmentVariable from '../services/cloud-runner-environment-variable';
import CloudRunnerLogger from '../services/cloud-runner-logger';
import { CloudRunnerFolders } from '../services/cloud-runner-folders';
import CloudRunner from '../cloud-runner';

export class AsyncWorkflow {
  public static async runAsyncWorkflow(
    environmentVariables: CloudRunnerEnvironmentVariable[],
    secrets: CloudRunnerSecret[],
  ): Promise<string> {
    try {
      CloudRunnerLogger.log(`Cloud Runner is running async mode`);

      let output = '';

      output += await CloudRunner.Provider.runTaskInWorkflow(
        CloudRunner.buildParameters.buildGuid,
        `ubuntu`,
        `apt-get update > /dev/null
apt-get install -y curl tar tree npm git git-lfs jq git > /dev/null
mkdir /builder
git clone -q -b ${CloudRunner.buildParameters.cloudRunnerBranch} /builder "builder"
node "builder/dist/index.js" -m async-workflow
        `,
        `/${CloudRunnerFolders.buildVolumeFolder}`,
        `/${CloudRunnerFolders.buildVolumeFolder}/`,
        environmentVariables,
        secrets,
      );

      return output;
    } catch (error) {
      throw error;
    }
  }
}
