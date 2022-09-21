import CloudRunnerLogger from '../services/cloud-runner-logger';
import { CloudRunnerFolders } from '../services/cloud-runner-folders';
import { CloudRunnerStepState } from '../cloud-runner-step-state';
import { CustomWorkflow } from './custom-workflow';
import { WorkflowInterface } from './workflow-interface';
import * as core from '@actions/core';
import { CloudRunnerCustomHooks } from '../services/cloud-runner-custom-hooks';
import path from 'path';
import CloudRunner from '../cloud-runner';
import CloudRunnerOptions from '../cloud-runner-options';
import SharedWorkspaceLocking from '../../cli/shared-workspace-locking';

export class BuildAutomationWorkflow implements WorkflowInterface {
  async run(cloudRunnerStepState: CloudRunnerStepState) {
    try {
      return await BuildAutomationWorkflow.standardBuildAutomation(cloudRunnerStepState.image, cloudRunnerStepState);
    } catch (error) {
      throw error;
    }
  }

  private static async standardBuildAutomation(baseImage: any, cloudRunnerStepState: CloudRunnerStepState) {
    // TODO accept post and pre build steps as yaml files in the repo
    try {
      CloudRunnerLogger.log(`Cloud Runner is running standard build automation`);

      if (!CloudRunner.buildParameters.isCliMode) core.startGroup('pre build steps');
      let output = '';
      if (CloudRunner.buildParameters.preBuildSteps !== '') {
        output += await CustomWorkflow.runCustomJob(CloudRunner.buildParameters.preBuildSteps);
      }
      if (!CloudRunner.buildParameters.isCliMode) core.endGroup();
      CloudRunnerLogger.logWithTime('Configurable pre build step(s) time');

      if (!CloudRunner.buildParameters.isCliMode) core.startGroup('build');
      CloudRunnerLogger.log(baseImage.toString());
      CloudRunnerLogger.logLine(` `);
      CloudRunnerLogger.logLine('Starting build automation job');

      // eslint-disable-next-line no-unused-vars
      const workspace = (await SharedWorkspaceLocking.GetLockedWorkspace()) || CloudRunner.buildParameters.buildGuid;

      output += await CloudRunner.Provider.runTask(
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

      if (!CloudRunner.buildParameters.isCliMode) core.startGroup('post build steps');
      if (CloudRunner.buildParameters.postBuildSteps !== '') {
        output += await CustomWorkflow.runCustomJob(CloudRunner.buildParameters.postBuildSteps);
      }
      if (!CloudRunner.buildParameters.isCliMode) core.endGroup();
      CloudRunnerLogger.logWithTime('Configurable post build step(s) time');

      CloudRunnerLogger.log(`Cloud Runner finished running standard build automation`);

      return output;
    } catch (error) {
      throw error;
    }
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
      apt-get install -y tar tree npm git-lfs jq git > /dev/null
      npm install -g n > /dev/null
      n stable > /dev/null
      ${setupHooks.filter((x) => x.hook.includes(`before`)).map((x) => x.commands) || ' '}
      export GITHUB_WORKSPACE="${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.repoPathAbsolute)}"
      ${BuildAutomationWorkflow.setupCommands(builderPath)}
      ${setupHooks.filter((x) => x.hook.includes(`after`)).map((x) => x.commands) || ' '}
      ${buildHooks.filter((x) => x.hook.includes(`before`)).map((x) => x.commands) || ' '}
      ${BuildAutomationWorkflow.BuildCommands(builderPath, CloudRunner.buildParameters.buildGuid)}
      ${buildHooks.filter((x) => x.hook.includes(`after`)).map((x) => x.commands) || ' '}`;
  }

  private static setupCommands(builderPath) {
    return `export GIT_DISCOVERY_ACROSS_FILESYSTEM=1
    echo "game ci cloud runner clone"
    mkdir -p ${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.builderPathAbsolute)}
    git clone -q -b ${CloudRunner.buildParameters.cloudRunnerBranch} ${CloudRunnerFolders.ToLinuxFolder(
      CloudRunnerFolders.unityBuilderRepoUrl,
    )} "${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.builderPathAbsolute)}"
    chmod +x ${builderPath}
    echo "game ci cloud runner bootstrap"
    node ${builderPath} -m remote-cli`;
  }

  // ToDo: Replace with a very simple "node ${builderPath} -m build-cli" to run the scripts below without enlarging the request size
  private static BuildCommands(builderPath, guid) {
    const linuxCacheFolder = CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.cacheFolderFull);
    const distFolder = path.join(CloudRunnerFolders.builderPathAbsolute, 'dist');
    const ubuntuPlatformsFolder = path.join(CloudRunnerFolders.builderPathAbsolute, 'dist', 'platforms', 'ubuntu');

    return `echo "game ci cloud runner init"
    mkdir -p ${`${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.projectBuildFolderAbsolute)}/build`}
    cd ${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.projectPathAbsolute)}
    cp -r "${CloudRunnerFolders.ToLinuxFolder(path.join(distFolder, 'default-build-script'))}" "/UnityBuilderAction"
    cp -r "${CloudRunnerFolders.ToLinuxFolder(path.join(ubuntuPlatformsFolder, 'entrypoint.sh'))}" "/entrypoint.sh"
    cp -r "${CloudRunnerFolders.ToLinuxFolder(path.join(ubuntuPlatformsFolder, 'steps'))}" "/steps"
    chmod -R +x "/entrypoint.sh"
    chmod -R +x "/steps"
    echo "game ci cloud runner start"
    /entrypoint.sh
    echo "game ci cloud runner push library to cache"
    chmod +x ${builderPath}
    node ${builderPath} -m cache-push --cachePushFrom ${CloudRunnerFolders.ToLinuxFolder(
      CloudRunnerFolders.libraryFolderAbsolute,
    )} --artifactName lib-${guid} --cachePushTo ${CloudRunnerFolders.ToLinuxFolder(`${linuxCacheFolder}/Library`)}
    echo "game ci cloud runner push build to cache"
    node ${builderPath} -m cache-push --cachePushFrom ${CloudRunnerFolders.ToLinuxFolder(
      CloudRunnerFolders.projectBuildFolderAbsolute,
    )} --artifactName build-${guid} --cachePushTo ${`${CloudRunnerFolders.ToLinuxFolder(`${linuxCacheFolder}/build`)}`}
    ${BuildAutomationWorkflow.GetCleanupCommand(CloudRunnerFolders.projectPathAbsolute)}`;
  }

  private static GetCleanupCommand(cleanupPath: string) {
    return CloudRunnerOptions.retainWorkspaces ? `` : `rm -r ${CloudRunnerFolders.ToLinuxFolder(cleanupPath)}`;
  }
}
