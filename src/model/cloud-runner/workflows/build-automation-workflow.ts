import CloudRunnerLogger from '../services/core/cloud-runner-logger';
import { CloudRunnerFolders } from '../options/cloud-runner-folders';
import { CloudRunnerStepParameters } from '../options/cloud-runner-step-parameters';
import { WorkflowInterface } from './workflow-interface';
import { CommandHookService } from '../services/hooks/command-hook-service';
import path from 'node:path';
import CloudRunner from '../cloud-runner';
import { ContainerHookService } from '../services/hooks/container-hook-service';

export class BuildAutomationWorkflow implements WorkflowInterface {
  async run(cloudRunnerStepState: CloudRunnerStepParameters) {
    return await BuildAutomationWorkflow.standardBuildAutomation(cloudRunnerStepState.image, cloudRunnerStepState);
  }

  private static async standardBuildAutomation(baseImage: string, cloudRunnerStepState: CloudRunnerStepParameters) {
    // TODO accept post and pre build steps as yaml files in the repo
    CloudRunnerLogger.log(`Cloud Runner is running standard build automation`);

    let output = '';

    output += await ContainerHookService.RunPreBuildSteps(cloudRunnerStepState);
    CloudRunnerLogger.logWithTime('Configurable pre build step(s) time');
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
    CloudRunnerLogger.logWithTime('Build time');

    output += await ContainerHookService.RunPostBuildSteps(cloudRunnerStepState);
    CloudRunnerLogger.logWithTime('Configurable post build step(s) time');

    CloudRunnerLogger.log(`Cloud Runner finished running standard build automation`);

    return output;
  }

  private static get BuildWorkflow() {
    const setupHooks = CommandHookService.getHooks(CloudRunner.buildParameters.commandHooks).filter((x) =>
      x.step?.includes(`setup`),
    );
    const buildHooks = CommandHookService.getHooks(CloudRunner.buildParameters.commandHooks).filter((x) =>
      x.step?.includes(`build`),
    );
    const builderPath = CloudRunnerFolders.ToLinuxFolder(
      path.join(CloudRunnerFolders.builderPathAbsolute, 'dist', `index.js`),
    );

    return `echo "cloud runner build workflow starting"
      apt-get update > /dev/null
      apt-get install -y curl tar tree npm git-lfs jq git > /dev/null
      npm --version
      npm i -g n > /dev/null
      npm i -g semver > /dev/null
      npm install --global yarn > /dev/null
      n 20.8.0
      node --version
      ${setupHooks.filter((x) => x.hook.includes(`before`)).map((x) => x.commands) || ' '}
      export GITHUB_WORKSPACE="${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.repoPathAbsolute)}"
      df -H /data/
      ${BuildAutomationWorkflow.setupCommands(builderPath)}
      ${setupHooks.filter((x) => x.hook.includes(`after`)).map((x) => x.commands) || ' '}
      ${buildHooks.filter((x) => x.hook.includes(`before`)).map((x) => x.commands) || ' '}
      ${BuildAutomationWorkflow.BuildCommands(builderPath)}
      ${buildHooks.filter((x) => x.hook.includes(`after`)).map((x) => x.commands) || ' '}`;
  }

  private static setupCommands(builderPath: string) {
    const commands = `mkdir -p ${CloudRunnerFolders.ToLinuxFolder(
      CloudRunnerFolders.builderPathAbsolute,
    )} && git clone -q -b ${CloudRunner.buildParameters.cloudRunnerBranch} ${
      CloudRunnerFolders.unityBuilderRepoUrl
    } "${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.builderPathAbsolute)}" && chmod +x ${builderPath}`;

    const cloneBuilderCommands = `if [ -e "${CloudRunnerFolders.ToLinuxFolder(
      CloudRunnerFolders.uniqueCloudRunnerJobFolderAbsolute,
    )}" ] && [ -e "${CloudRunnerFolders.ToLinuxFolder(
      path.join(CloudRunnerFolders.builderPathAbsolute, `.git`),
    )}" ] ; then echo "Builder Already Exists!" && tree ${
      CloudRunnerFolders.builderPathAbsolute
    }; else ${commands} ; fi`;

    return `export GIT_DISCOVERY_ACROSS_FILESYSTEM=1
${cloneBuilderCommands}
echo "log start" >> /home/job-log.txt
node ${builderPath} -m remote-cli-pre-build`;
  }

  private static BuildCommands(builderPath: string) {
    const distFolder = path.join(CloudRunnerFolders.builderPathAbsolute, 'dist');
    const ubuntuPlatformsFolder = path.join(CloudRunnerFolders.builderPathAbsolute, 'dist', 'platforms', 'ubuntu');

    return `
    mkdir -p ${`${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.projectBuildFolderAbsolute)}/build`}
    cd ${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.projectPathAbsolute)}
    cp -r "${CloudRunnerFolders.ToLinuxFolder(path.join(distFolder, 'default-build-script'))}" "/UnityBuilderAction"
    cp -r "${CloudRunnerFolders.ToLinuxFolder(path.join(ubuntuPlatformsFolder, 'entrypoint.sh'))}" "/entrypoint.sh"
    cp -r "${CloudRunnerFolders.ToLinuxFolder(path.join(ubuntuPlatformsFolder, 'steps'))}" "/steps"
    chmod -R +x "/entrypoint.sh"
    chmod -R +x "/steps"
    echo "game ci start"
    echo "game ci start" >> /home/job-log.txt
    /entrypoint.sh | node ${builderPath} -m remote-cli-log-stream --logFile /home/job-log.txt
    node ${builderPath} -m remote-cli-post-build`;
  }
}
