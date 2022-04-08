import CloudRunnerLogger from '../services/cloud-runner-logger';
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

      if (!CloudRunner.buildParameters.cliMode) core.startGroup('build');
      CloudRunnerLogger.log(baseImage.toString());
      CloudRunnerLogger.logLine(` `);
      CloudRunnerLogger.logLine('Starting build automation job');

      output += await CloudRunner.CloudRunnerProviderPlatform.runTask(
        CloudRunner.buildParameters.buildGuid,
        baseImage.toString(),
        BuildAutomationWorkflow.FullWorkflow,
        `/${CloudRunnerFolders.buildVolumeFolder}`,
        `/${CloudRunnerFolders.buildVolumeFolder}/`,
        CloudRunner.cloudRunnerEnvironmentVariables,
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
    const setupHooks = CloudRunnerBuildCommandProcessor.getHooks(CloudRunner.buildParameters.customJobHooks).filter(
      (x) => x.step.includes(`setup`),
    );
    const buildHooks = CloudRunnerBuildCommandProcessor.getHooks(CloudRunner.buildParameters.customJobHooks).filter(
      (x) => x.step.includes(`build`),
    );
    const builderPath = path.join(CloudRunnerFolders.builderPathFull, 'dist', `index.js`).replace(/\\/g, `/`);
    return `apt-get update > /dev/null
      apt-get install -y zip tree npm git-lfs jq unzip git > /dev/null
      npm install -g n > /dev/null
      n stable > /dev/null
      ${setupHooks.filter((x) => x.hook.includes(`before`)).map((x) => x.commands) || ' '}
      export GITHUB_WORKSPACE="${CloudRunnerFolders.repoPathFull.replace(/\\/g, `/`)}"
      ${BuildAutomationWorkflow.SetupCommands(builderPath)}
      ${setupHooks.filter((x) => x.hook.includes(`after`)).map((x) => x.commands) || ' '}
      ${buildHooks.filter((x) => x.hook.includes(`before`)).map((x) => x.commands) || ' '}
      ${BuildAutomationWorkflow.BuildCommands(builderPath, CloudRunner.buildParameters.buildGuid)}
      ${buildHooks.filter((x) => x.hook.includes(`after`)).map((x) => x.commands) || ' '}`;
  }

  private static SetupCommands(builderPath) {
    return `export GIT_DISCOVERY_ACROSS_FILESYSTEM=1
    echo "game ci cloud runner clone"
    mkdir -p ${CloudRunnerFolders.builderPathFull.replace(/\\/g, `/`)}
    git clone -q -b ${CloudRunner.buildParameters.cloudRunnerBranch} ${
      CloudRunnerFolders.unityBuilderRepoUrl
    } "${CloudRunnerFolders.builderPathFull.replace(/\\/g, `/`)}"
    chmod +x ${builderPath}
    echo "game ci cloud runner bootstrap"
    node ${builderPath} -m remote-cli`;
  }

  private static BuildCommands(builderPath, guid) {
    const linuxCacheFolder = CloudRunnerFolders.cacheFolderFull.replace(/\\/g, `/`);
    const distFolder = path.join(CloudRunnerFolders.builderPathFull, 'dist');
    const ubuntuPlatformsFolder = path.join(CloudRunnerFolders.builderPathFull, 'dist', 'platforms', 'ubuntu');
    return `echo "game ci cloud runner init"
    mkdir -p ${`${CloudRunnerFolders.projectBuildFolderFull}/build`.replace(/\\/g, `/`)}
    cd ${CloudRunnerFolders.projectPathFull}
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
      CloudRunnerFolders.libraryFolderFull
    } --artifactName lib-${guid} --cachePushTo ${linuxCacheFolder}/Library
    echo "game ci cloud runner push build to cache"
    node ${builderPath} -m cache-push --cachePushFrom ${
      CloudRunnerFolders.projectBuildFolderFull
    } --artifactName build-${guid} --cachePushTo ${linuxCacheFolder}/build`;
  }
}
