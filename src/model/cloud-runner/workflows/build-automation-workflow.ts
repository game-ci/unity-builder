import CloudRunnerLogger from '../services/cloud-runner-logger';
import { TaskParameterSerializer } from '../services/task-parameter-serializer';
import { CloudRunnerFolders } from '../services/cloud-runner-folders';
import { CloudRunnerStepState } from '../cloud-runner-step-state';
import { CustomWorkflow } from './custom-workflow';
import { WorkflowInterface } from './workflow-interface';
import * as core from '@actions/core';
import { CloudRunnerBuildCommandProcessor } from '../services/cloud-runner-build-command-process';
import path from 'path';
import CloudRunner from '../cloud-runner';

export class BuildAutomationWorkflow implements WorkflowInterface {
  async run(cloudRunnerStepState: CloudRunnerStepState) {
    try {
      return await BuildAutomationWorkflow.standardBuildAutomation(cloudRunnerStepState.image);
    } catch (error) {
      throw error;
    }
  }

  private static async standardBuildAutomation(baseImage: any) {
    try {
      CloudRunnerLogger.log(`Cloud Runner is running standard build automation`);

      if (!CloudRunner.buildParameters.cliMode) core.startGroup('pre build steps');
      let output = '';
      if (CloudRunner.buildParameters.preBuildSteps !== '') {
        output += await CustomWorkflow.runCustomJob(CloudRunner.buildParameters.preBuildSteps);
      }
      if (!CloudRunner.buildParameters.cliMode) core.endGroup();
      CloudRunnerLogger.logWithTime('Configurable pre build step(s) time');

      // core.startGroup('setup');
      // output += await new SetupStep().run(
      //   new CloudRunnerStepState(
      //     'alpine/git',
      //     TaskParameterSerializer.readBuildEnvironmentVariables(),
      //     CloudRunnerState.defaultSecrets,
      //   ),
      // );
      // core.endGroup();
      // CloudRunnerLogger.logWithTime('Download repository step time');

      if (!CloudRunner.buildParameters.cliMode) core.startGroup('build');
      CloudRunnerLogger.log(baseImage.toString());
      CloudRunnerLogger.logLine(` `);
      CloudRunnerLogger.logLine('Starting build automation job');

      output += await CloudRunner.CloudRunnerProviderPlatform.runTask(
        CloudRunner.buildParameters.buildGuid,
        baseImage.toString(),
        BuildAutomationWorkflow.FullWorkflow,
        `/${CloudRunnerFolders.buildVolumeFolder}`,
        `/${CloudRunnerFolders.projectPathFull}`,
        TaskParameterSerializer.readBuildEnvironmentVariables(),
        CloudRunner.defaultSecrets,
      );
      if (!CloudRunner.buildParameters.cliMode) core.endGroup();
      CloudRunnerLogger.logWithTime('Build time');

      if (!CloudRunner.buildParameters.cliMode) core.startGroup('post build steps');
      if (CloudRunner.buildParameters.postBuildSteps !== '') {
        output += await CustomWorkflow.runCustomJob(CloudRunner.buildParameters.postBuildSteps);
      }
      if (!CloudRunner.buildParameters.cliMode) core.endGroup();
      CloudRunnerLogger.logWithTime('Configurable post build step(s) time');

      CloudRunnerLogger.log(`Cloud Runner finished running standard build automation`);

      return output;
    } catch (error) {
      throw error;
    }
  }

  private static get FullWorkflow() {
    const hooks = CloudRunnerBuildCommandProcessor.getHooks(CloudRunner.buildParameters.customJobHooks).filter((x) =>
      x.step.includes(`setup`),
    );
    return `apt-get update
      apt-get install -y -q zip tree nodejs git-lfs jq unzip
      ${hooks.filter((x) => x.hook.includes(`before`)).map((x) => x.commands) || ' '}
      export GITHUB_WORKSPACE="${CloudRunnerFolders.repoPathFull}"
      ${BuildAutomationWorkflow.SetupCommands}
      ${hooks.filter((x) => x.hook.includes(`after`)).map((x) => x.commands) || ' '}
      ${BuildAutomationWorkflow.BuildCommands}`;
  }

  private static get SetupCommands() {
    return `export GIT_DISCOVERY_ACROSS_FILESYSTEM=1
    echo "cloning"
    mkdir -p ${CloudRunnerFolders.builderPathFull.replace(/\\/g, `/`)}
    git clone -q -b ${CloudRunner.buildParameters.cloudRunnerBranch} ${
      CloudRunnerFolders.unityBuilderRepoUrl
    } "${CloudRunnerFolders.builderPathFull.replace(/\\/g, `/`)}"
    ${
      CloudRunner.buildParameters.cloudRunnerIntegrationTests ? '' : '#'
    } tree ${CloudRunnerFolders.builderPathFull.replace(/\\/g, `/`)}
    chmod +x ${path.join(CloudRunnerFolders.builderPathFull, 'dist', `index.js`).replace(/\\/g, `/`)}
    echo "caching"
    node ${path.join(CloudRunnerFolders.builderPathFull, 'dist', `index.js`).replace(/\\/g, `/`)} -m remote-cli`;
  }

  private static get BuildCommands() {
    return `cp -r "${path
      .join(CloudRunnerFolders.builderPathFull, 'dist', 'default-build-script')
      .replace(/\\/g, `/`)}" "/UnityBuilderAction"
      cp -r "${path
        .join(CloudRunnerFolders.builderPathFull, 'dist', 'platforms', 'ubuntu', 'entrypoint.sh')
        .replace(/\\/g, `/`)}" "/entrypoint.sh"
      cp -r "${path
        .join(CloudRunnerFolders.builderPathFull, 'dist', 'platforms', 'ubuntu', 'steps')
        .replace(/\\/g, `/`)}" "/steps"
      chmod -R +x "/entrypoint.sh"
      chmod -R +x "/steps"
      /entrypoint.sh
      cd "${CloudRunnerFolders.libraryFolderFull.replace(/\\/g, `/`)}/.."
      zip -r "lib-${CloudRunner.buildParameters.buildGuid}.zip" "Library"
      mv "lib-${CloudRunner.buildParameters.buildGuid}.zip" "${CloudRunnerFolders.cacheFolderFull.replace(
      /\\/g,
      `/`,
    )}/Library"
      cd "${CloudRunnerFolders.repoPathFull.replace(/\\/g, `/`)}"
      zip -r "build-${CloudRunner.buildParameters.buildGuid}.zip" "build"
      mv "build-${CloudRunner.buildParameters.buildGuid}.zip" "${CloudRunnerFolders.cacheFolderFull.replace(
      /\\/g,
      `/`,
    )}"
    chmod +x ${path.join(CloudRunnerFolders.builderPathFull, 'dist', `index.js`).replace(/\\/g, `/`)}
    node ${path
      .join(CloudRunnerFolders.builderPathFull, 'dist', `index.js`)
      .replace(/\\/g, `/`)} -m cache-push "Library" "lib-${
      CloudRunner.buildParameters.buildGuid
    }.zip" "${CloudRunnerFolders.cacheFolderFull.replace(/\\/g, `/`)}/Library"
    ${CloudRunner.buildParameters.cloudRunnerIntegrationTests ? '' : '#'} tree -lh "${
      CloudRunnerFolders.cacheFolderFull
    }"`;
  }
}
