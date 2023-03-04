import CloudRunnerLogger from '../services/cloud-runner-logger';
import { CloudRunnerFolders } from '../services/cloud-runner-folders';
import { CloudRunnerStepState } from '../cloud-runner-step-state';
import { WorkflowInterface } from './workflow-interface';
import * as core from '@actions/core';
import { CloudRunnerCustomHooks } from '../services/cloud-runner-custom-hooks';
import path from 'node:path';
import CloudRunner from '../cloud-runner';
import CloudRunnerOptions from '../cloud-runner-options';
import { CloudRunnerCustomSteps } from '../services/cloud-runner-custom-steps';

export class BuildAutomationWorkflow implements WorkflowInterface {
  async run(cloudRunnerStepState: CloudRunnerStepState) {
    return await BuildAutomationWorkflow.standardBuildAutomation(cloudRunnerStepState.image, cloudRunnerStepState);
  }

  private static async standardBuildAutomation(baseImage: string, cloudRunnerStepState: CloudRunnerStepState) {
    // TODO accept post and pre build steps as yaml files in the repo
    CloudRunnerLogger.log(`Cloud Runner is running standard build automation`);

    let output = '';

    output += await CloudRunnerCustomSteps.RunPreBuildSteps(cloudRunnerStepState);
    CloudRunnerLogger.logWithTime('Configurable pre build step(s) time');

    if (!CloudRunner.buildParameters.isCliMode) core.startGroup('build');
    CloudRunnerLogger.log(baseImage);
    CloudRunnerLogger.logLine(` `);
    CloudRunnerLogger.logLine('Starting build automation job');

    output += await CloudRunner.Provider.runTaskInWorkflow(
      CloudRunner.buildParameters.buildGuid,
      baseImage.toString(),
      BuildAutomationWorkflow.BuildWorkflow,
      `/${CloudRunnerFolders.buildVolumeFolder}`,
      `/${CloudRunnerFolders.buildVolumeFolder}/`,
      cloudRunnerStepState.environment,
      cloudRunnerStepState.secrets,
    );
    if (!CloudRunner.buildParameters.isCliMode) core.endGroup();
    CloudRunnerLogger.logWithTime('Build time');

    output += await CloudRunnerCustomSteps.RunPostBuildSteps(cloudRunnerStepState);
    CloudRunnerLogger.logWithTime('Configurable post build step(s) time');

    CloudRunnerLogger.log(`Cloud Runner finished running standard build automation`);

    return output;
  }

  private static get BuildWorkflow() {
    const setupHooks = CloudRunnerCustomHooks.getHooks(CloudRunner.buildParameters.customJobHooks).filter((x) =>
      x.step.includes(`setup`),
    );
    const buildHooks = CloudRunnerCustomHooks.getHooks(CloudRunner.buildParameters.customJobHooks).filter((x) =>
      x.step.includes(`build`),
    );
    const builderPath = CloudRunnerFolders.ToLinuxFolder(
      path.join(CloudRunnerFolders.builderPathAbsolute, 'dist', `index.js`),
    );

    return `apt-get update > /dev/null
      apt-get install -y curl tar tree npm git-lfs jq git > /dev/null
      npm i -g n > /dev/null
      n 16.15.1 > /dev/null
      npm --version
      node --version
      ${BuildAutomationWorkflow.TreeCommand}
      ${setupHooks.filter((x) => x.hook.includes(`before`)).map((x) => x.commands) || ' '}
      export GITHUB_WORKSPACE="${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.repoPathAbsolute)}"
      ${BuildAutomationWorkflow.setupCommands(builderPath)}
      ${setupHooks.filter((x) => x.hook.includes(`after`)).map((x) => x.commands) || ' '}
      ${BuildAutomationWorkflow.TreeCommand}
      ${buildHooks.filter((x) => x.hook.includes(`before`)).map((x) => x.commands) || ' '}
      ${BuildAutomationWorkflow.BuildCommands(builderPath)}
      ${buildHooks.filter((x) => x.hook.includes(`after`)).map((x) => x.commands) || ' '}
      ${BuildAutomationWorkflow.TreeCommand}`;
  }

  private static setupCommands(builderPath: string) {
    const commands = `mkdir -p ${CloudRunnerFolders.ToLinuxFolder(
      CloudRunnerFolders.builderPathAbsolute,
    )} && git clone -q -b ${CloudRunner.buildParameters.cloudRunnerBranch} ${
      CloudRunnerFolders.unityBuilderRepoUrl
    } "${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.builderPathAbsolute)}" && chmod +x ${builderPath}`;

    const retainedWorkspaceCommands = `if [ -e "${CloudRunnerFolders.ToLinuxFolder(
      CloudRunnerFolders.uniqueCloudRunnerJobFolderAbsolute,
    )}" ] && [ -e "${CloudRunnerFolders.ToLinuxFolder(
      path.join(CloudRunnerFolders.repoPathAbsolute, `.git`),
    )}" ]; then echo "Retained Workspace Already Exists!" ; fi`;

    const cloneBuilderCommands = `if [ -e "${CloudRunnerFolders.ToLinuxFolder(
      CloudRunnerFolders.uniqueCloudRunnerJobFolderAbsolute,
    )}" ] && [ -e "${CloudRunnerFolders.ToLinuxFolder(
      path.join(CloudRunnerFolders.builderPathAbsolute, `.git`),
    )}" ]; then echo "Builder Already Exists!"; else ${commands}; fi`;

    return `export GIT_DISCOVERY_ACROSS_FILESYSTEM=1
    echo "downloading game-ci..."
    ${retainedWorkspaceCommands}
    ${cloneBuilderCommands}
    echo "bootstrap game ci cloud runner..."
    node ${builderPath} -m remote-cli-pre-build`;
  }

  private static BuildCommands(builderPath: string) {
    const distFolder = path.join(CloudRunnerFolders.builderPathAbsolute, 'dist');
    const ubuntuPlatformsFolder = path.join(CloudRunnerFolders.builderPathAbsolute, 'dist', 'platforms', 'ubuntu');

    return `echo "game ci cloud runner initalized"
    mkdir -p ${`${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.projectBuildFolderAbsolute)}/build`}
    cd ${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.projectPathAbsolute)}
    cp -r "${CloudRunnerFolders.ToLinuxFolder(path.join(distFolder, 'default-build-script'))}" "/UnityBuilderAction"
    cp -r "${CloudRunnerFolders.ToLinuxFolder(path.join(ubuntuPlatformsFolder, 'entrypoint.sh'))}" "/entrypoint.sh"
    cp -r "${CloudRunnerFolders.ToLinuxFolder(path.join(ubuntuPlatformsFolder, 'steps'))}" "/steps"
    chmod -R +x "/entrypoint.sh"
    chmod -R +x "/steps"
    echo "game ci start"
    /entrypoint.sh
    echo "game ci caching results"
    chmod +x ${builderPath}
    node ${builderPath} -m remote-cli-post-build`;
  }

  private static get TreeCommand(): string {
    return CloudRunnerOptions.cloudRunnerDebugTree
      ? `tree -L 2 ${CloudRunnerFolders.uniqueCloudRunnerJobFolderAbsolute} && tree -L 2 ${CloudRunnerFolders.cacheFolderForCacheKeyFull} && du -h -s /${CloudRunnerFolders.buildVolumeFolder}/ && du -h -s ${CloudRunnerFolders.cacheFolderForAllFull}`
      : `#`;
  }
}
