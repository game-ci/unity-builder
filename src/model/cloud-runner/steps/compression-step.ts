import CloudRunnerEnvironmentVariable from '../services/cloud-runner-environment-variable';
import CloudRunnerLogger from '../services/cloud-runner-logger';
import CloudRunnerSecret from '../services/cloud-runner-secret';
import { CloudRunnerState } from '../state/cloud-runner-state';
import { CloudRunnerStepState } from '../state/cloud-runner-step-state';
import { StepInterface } from './step-interface';

export class CompressionStep implements StepInterface {
  async run(cloudRunnerStepState: CloudRunnerStepState) {
    await CompressionStep.CompressionStep(cloudRunnerStepState.environment, cloudRunnerStepState.secrets);
  }

  private static async CompressionStep(
    environmentVariables: CloudRunnerEnvironmentVariable[],
    secrets: CloudRunnerSecret[],
  ) {
    try {
      CloudRunnerLogger.logLine('Starting step 3/4 build compression');
      // Cleanup
      await CloudRunnerState.CloudRunnerProviderPlatform.runBuildTask(
        CloudRunnerState.buildGuid,
        'alpine',
        [
          `
            apk update -q
            apk add zip tree -q
            ${process.env.DEBUG ? '' : '#'}tree -L 4 "$repoPathFull"
            ${process.env.DEBUG ? '' : '#'}ls -lh "$repoPathFull"
            cd "$libraryFolderFull/.."
            zip -r "lib-$BUILDID.zip" "./Library"
            mv "lib-$BUILDID.zip" "/$cacheFolderFull/lib"
            cd "$repoPathFull"
            ls -lh "$repoPathFull"
            zip -r "build-$BUILDID.zip" "./${CloudRunnerState.buildParams.buildPath}"
            mv "build-$BUILDID.zip" "/$cacheFolderFull/build-$BUILDID.zip"
            ${process.env.DEBUG ? '' : '#'}tree -L 4 "/$cacheFolderFull"
            ${process.env.DEBUG ? '' : '#'}tree -L 4 "/$cacheFolderFull/.."
            ${process.env.DEBUG ? '' : '#'}tree -L 4 "$repoPathFull"
            ${process.env.DEBUG ? '' : '#'}ls -lh "$repoPathFull"
          `,
        ],
        `/${CloudRunnerState.buildVolumeFolder}`,
        `/${CloudRunnerState.buildVolumeFolder}`,
        [
          ...environmentVariables,
          ...[
            {
              name: 'cacheFolderFull',
              value: CloudRunnerState.cacheFolderFull,
            },
          ],
        ],
        secrets,
      );
      CloudRunnerLogger.log('compression step complete');
    } catch (error) {
      throw error;
    }
  }
}
