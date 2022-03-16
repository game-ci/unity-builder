import path from 'path';
import { Input } from '../..';
import { CloudRunnerBuildCommandProcessor } from '../services/cloud-runner-build-command-process';
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
    const hooks = CloudRunnerBuildCommandProcessor.getHooks(CloudRunnerState.buildParams.customJobHooks).filter((x) =>
      x.step.includes(`setup`),
    );
    return await CloudRunnerState.CloudRunnerProviderPlatform.runTask(
      CloudRunnerState.buildParams.buildGuid,
      image,
      `${hooks.filter((x) => x.hook.includes(`before`)).map((x) => x.commands) || ' '}
        export GITHUB_WORKSPACE="${CloudRunnerState.repoPathFull}"
        cp -r "${path
          .join(CloudRunnerState.builderPathFull, 'dist', 'default-build-script')
          .replace(/\\/g, `/`)}" "/UnityBuilderAction"
        cp -r "${path
          .join(CloudRunnerState.builderPathFull, 'dist', 'platforms', 'ubuntu', 'entrypoint.sh')
          .replace(/\\/g, `/`)}" "/entrypoint.sh"
        cp -r "${path
          .join(CloudRunnerState.builderPathFull, 'dist', 'platforms', 'ubuntu', 'steps')
          .replace(/\\/g, `/`)}" "/steps"
        chmod -R +x "/entrypoint.sh"
        chmod -R +x "/steps"
        /entrypoint.sh
        apt-get update
        apt-get install -y -q zip tree nodejs
        cd "${CloudRunnerState.libraryFolderFull.replace(/\\/g, `/`)}/.."
        zip -r "lib-${CloudRunnerState.buildParams.buildGuid}.zip" "Library"
        mv "lib-${CloudRunnerState.buildParams.buildGuid}.zip" "${CloudRunnerState.cacheFolderFull.replace(
        /\\/g,
        `/`,
      )}/Library"
        cd "${CloudRunnerState.repoPathFull.replace(/\\/g, `/`)}"
        zip -r "build-${CloudRunnerState.buildParams.buildGuid}.zip" "build"
        mv "build-${CloudRunnerState.buildParams.buildGuid}.zip" "${CloudRunnerState.cacheFolderFull.replace(
        /\\/g,
        `/`,
      )}"
        chmod +x ${path.join(CloudRunnerState.builderPathFull, 'dist', `index.js`).replace(/\\/g, `/`)}
        node ${path
          .join(CloudRunnerState.builderPathFull, 'dist', `index.js`)
          .replace(/\\/g, `/`)} -m cache-push "Library" "lib-${
        CloudRunnerState.buildParams.buildGuid
      }.zip" "${CloudRunnerState.cacheFolderFull.replace(/\\/g, `/`)}/Library"
        ${Input.cloudRunnerTests ? '' : '#'} tree -lh "${CloudRunnerState.cacheFolderFull}"
        ${hooks.filter((x) => x.hook.includes(`after`)).map((x) => x.commands) || ' '}
      `,
      `/${CloudRunnerState.buildVolumeFolder}`,
      `/${CloudRunnerState.projectPathFull}`,
      environmentVariables,
      secrets,
    );
  }
}
