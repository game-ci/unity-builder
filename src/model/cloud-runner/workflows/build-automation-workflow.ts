import CloudRunnerLogger from '../services/cloud-runner-logger.ts';
import { CloudRunnerFolders } from '../services/cloud-runner-folders.ts';
import { CloudRunnerStepState } from '../cloud-runner-step-state.ts';
import { CustomWorkflow } from './custom-workflow.ts';
import { WorkflowInterface } from './workflow-interface.ts';
import * as core from '../../../../node_modules/@actions/core';
import { CloudRunnerBuildCommandProcessor } from '../services/cloud-runner-build-command-process.ts';
import * as path from 'https://deno.land/std@0.141.0/path/mod.ts';
import CloudRunner from '../cloud-runner.ts';

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

      output += await CloudRunner.Provider.runTask(
        CloudRunner.buildParameters.buildGuid,
        baseImage.toString(),
        BuildAutomationWorkflow.BuildWorkflow,
        `/${CloudRunnerFolders.buildVolumeFolder}`,
        `/${CloudRunnerFolders.buildVolumeFolder}/`,
        CloudRunner.cloudRunnerEnvironmentVariables,
        CloudRunner.defaultSecrets,
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
    const setupHooks = CloudRunnerBuildCommandProcessor.getHooks(CloudRunner.buildParameters.customJobHooks).filter(
      (x) => x.step.includes(`setup`),
    );
    const buildHooks = CloudRunnerBuildCommandProcessor.getHooks(CloudRunner.buildParameters.customJobHooks).filter(
      (x) => x.step.includes(`build`),
    );
    const builderPath = path.join(CloudRunnerFolders.builderPathAbsolute, 'dist', `index.js`).replace(/\\/g, `/`);

    return `apt-get update > /dev/null
      apt-get install -y tar tree npm git-lfs jq git > /dev/null
      npm install -g n > /dev/null
      n stable > /dev/null
      ${setupHooks.filter((x) => x.hook.includes(`before`)).map((x) => x.commands) || ' '}
      export GITHUB_WORKSPACE="${CloudRunnerFolders.repoPathAbsolute.replace(/\\/g, `/`)}"
      ${BuildAutomationWorkflow.setupCommands(builderPath)}
      ${setupHooks.filter((x) => x.hook.includes(`after`)).map((x) => x.commands) || ' '}
      ${buildHooks.filter((x) => x.hook.includes(`before`)).map((x) => x.commands) || ' '}
      ${BuildAutomationWorkflow.BuildCommands(builderPath, CloudRunner.buildParameters.buildGuid)}
      ${buildHooks.filter((x) => x.hook.includes(`after`)).map((x) => x.commands) || ' '}`;
  }

  private static setupCommands(builderPath) {
    return `export GIT_DISCOVERY_ACROSS_FILESYSTEM=1
    echo "game ci cloud runner clone"
    mkdir -p ${CloudRunnerFolders.builderPathAbsolute.replace(/\\/g, `/`)}
    git clone -q -b ${CloudRunner.buildParameters.cloudRunnerBranch} ${
      CloudRunnerFolders.unityBuilderRepoUrl
    } "${CloudRunnerFolders.builderPathAbsolute.replace(/\\/g, `/`)}"
    chmod +x ${builderPath}
    echo "game ci cloud runner bootstrap"
    node ${builderPath} -m remote-cli`;
  }

  private static BuildCommands(builderPath, guid) {
    const linuxCacheFolder = CloudRunnerFolders.cacheFolderFull.replace(/\\/g, `/`);
    const distFolder = path.join(CloudRunnerFolders.builderPathAbsolute, 'dist');
    const ubuntuPlatformsFolder = path.join(CloudRunnerFolders.builderPathAbsolute, 'dist', 'platforms', 'ubuntu');

    return `echo "game ci cloud runner init"
    mkdir -p ${`${CloudRunnerFolders.projectBuildFolderAbsolute}/build`.replace(/\\/g, `/`)}
    cd ${CloudRunnerFolders.projectPathAbsolute}
    cp -r "${path.join(distFolder, 'default-build-script').replace(/\\/g, `/`)}" "/UnityBuilderAction"
    cp -r "${path.join(ubuntuPlatformsFolder, 'entrypoint.sh').replace(/\\/g, `/`)}" "/entrypoint.sh"
    cp -r "${path.join(ubuntuPlatformsFolder, 'steps').replace(/\\/g, `/`)}" "/steps"
    chmod -R +x "/entrypoint.sh"
    chmod -R +x "/steps"
    echo "game ci cloud runner start"
    /entrypoint.sh
    echo "game ci cloud runner push library to cache"
    chmod +x ${builderPath}
    node ${builderPath} -m cache-push --cachePushFrom ${
      CloudRunnerFolders.libraryFolderAbsolute
    } --artifactName lib-${guid} --cachePushTo ${linuxCacheFolder}/Library
    echo "game ci cloud runner push build to cache"
    node ${builderPath} -m cache-push --cachePushFrom ${
      CloudRunnerFolders.projectBuildFolderAbsolute
    } --artifactName build-${guid} --cachePushTo ${`${linuxCacheFolder}/build`.replace(/\\/g, `/`)}`;
  }
}
