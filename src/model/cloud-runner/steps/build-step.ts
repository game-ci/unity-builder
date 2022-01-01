import path from 'path';
import CloudRunnerEnvironmentVariable from '../services/cloud-runner-environment-variable';
import CloudRunnerLogger from '../services/cloud-runner-logger';
import CloudRunnerSecret from '../services/cloud-runner-secret';
import { CloudRunnerState } from '../state/cloud-runner-state';
import { CloudRunnerStepState } from '../state/cloud-runner-step-state';
import { StepInterface } from './step-interface';

export class BuildStep implements StepInterface {
  async run(cloudRunnerStepState: CloudRunnerStepState) {
    return await BuildStep.BuildStep(
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
    CloudRunnerLogger.logLine(` `);
    CloudRunnerLogger.logLine('Starting part 2/2 (build unity project)');
    return await CloudRunnerState.CloudRunnerProviderPlatform.runTask(
      CloudRunnerState.buildParams.buildGuid,
      image,
      `
        export GITHUB_WORKSPACE="${CloudRunnerState.repoPathFull}"
        cp -r "${path
          .join(CloudRunnerState.builderPathFull, 'dist', 'default-build-script')
          .replace(/\\/g, `/`)}" "/UnityBuilderAction"
        cp -r "${path
          .join(CloudRunnerState.builderPathFull, 'dist', 'entrypoint.sh')
          .replace(/\\/g, `/`)}" "/entrypoint.sh"
        cp -r "${path.join(CloudRunnerState.builderPathFull, 'dist', 'steps').replace(/\\/g, `/`)}" "/steps"
        chmod -R +x "/entrypoint.sh"
        chmod -R +x "/steps"
        /entrypoint.sh
        apt-get update
        apt-get install -y -q zip tree
        cd "${CloudRunnerState.libraryFolderFull.replace(/\\/g, `/`)}/.."
        zip -r "lib-${CloudRunnerState.buildParams.buildGuid}.zip" "Library"
        mv "lib-${CloudRunnerState.buildParams.buildGuid}.zip" "${CloudRunnerState.cacheFolderFull.replace(
        /\\/g,
        `/`,
      )}/lib"
        tree -lh "${CloudRunnerState.repoPathFull}"
        zip -r "build-${CloudRunnerState.buildParams.buildGuid}.zip" "build"
        tree -lh "${CloudRunnerState.repoPathFull}"

        tree -lh "${CloudRunnerState.cacheFolderFull}"
        mv "build-${CloudRunnerState.buildParams.buildGuid}.zip" "${CloudRunnerState.cacheFolderFull.replace(
        /\\/g,
        `/`,
      )}"
        tree -lh "${CloudRunnerState.cacheFolderFull}"
        echo " "
        ls
      `,
      `/${CloudRunnerState.buildVolumeFolder}`,
      `/${CloudRunnerState.projectPathFull}`,
      environmentVariables,
      secrets,
    );
  }
}
