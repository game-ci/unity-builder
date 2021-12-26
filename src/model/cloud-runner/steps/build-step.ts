import CloudRunnerEnvironmentVariable from '../services/cloud-runner-environment-variable';
import CloudRunnerLogger from '../services/cloud-runner-logger';
import CloudRunnerSecret from '../services/cloud-runner-secret';
import { CloudRunnerState } from '../state/cloud-runner-state';
import { CloudRunnerStepState } from '../state/cloud-runner-step-state';
import { StepInterface } from './step-interface';

export class BuildStep implements StepInterface {
  async run(cloudRunnerStepState: CloudRunnerStepState) {
    await BuildStep.BuildStep(
      cloudRunnerStepState.image,
      cloudRunnerStepState.environment,
      cloudRunnerStepState.secrets,
    );
  }

  private static async BuildStep(
    image: string,
    environmentVariables: CloudRunnerEnvironmentVariable[],
    secrets: CloudRunnerSecret[],
  ) {
    CloudRunnerLogger.logLine('Starting part 2/2 (build unity project)');
    await CloudRunnerState.CloudRunnerProviderPlatform.runTask(
      CloudRunnerState.buildGuid,
      image,
      [
        `
            export GITHUB_WORKSPACE="${CloudRunnerState.repoPathFull}"
            cp -r "${CloudRunnerState.builderPathFull}/dist/default-build-script/" "/UnityBuilderAction"
            cp -r "${CloudRunnerState.builderPathFull}/dist/entrypoint.sh" "/entrypoint.sh"
            cp -r "${CloudRunnerState.builderPathFull}/dist/steps/" "/steps"
            chmod -R +x "/entrypoint.sh"
            chmod -R +x "/steps"
            /entrypoint.sh
            apt-get update
            apt-get install -y -q zip
            cd "$libraryFolderFull/.."
            zip -r "lib-$BUILDID.zip" "./Library"
            mv "lib-$BUILDID.zip" "/$cacheFolderFull/lib"
            ls -lh "/$cacheFolderFull/lib"
            cd "$repoPathFull"
            ls -lh "$repoPathFull"
            zip -r "build-$BUILDID.zip" "./${CloudRunnerState.buildParams.buildPath}"
            mv "build-$BUILDID.zip" "/$cacheFolderFull/build-$BUILDID.zip"
          `,
      ],
      `/${CloudRunnerState.buildVolumeFolder}`,
      `/${CloudRunnerState.projectPathFull}`,
      environmentVariables,
      secrets,
    );
  }
}
