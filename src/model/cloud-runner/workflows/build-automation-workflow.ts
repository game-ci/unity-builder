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
    const isContainerized =
      CloudRunner.buildParameters.providerStrategy === 'aws' ||
      CloudRunner.buildParameters.providerStrategy === 'k8s' ||
      CloudRunner.buildParameters.providerStrategy === 'local-docker';

    const builderPath = isContainerized
      ? CloudRunnerFolders.ToLinuxFolder(path.join(CloudRunnerFolders.builderPathAbsolute, 'dist', `index.js`))
      : CloudRunnerFolders.ToLinuxFolder(path.join(process.cwd(), 'dist', `index.js`));

    return `echo "cloud runner build workflow starting"
      ${isContainerized ? 'apt-get update > /dev/null' : '# skipping apt-get in non-container provider'}
      ${
        isContainerized
          ? 'apt-get install -y curl tar tree npm git-lfs jq git > /dev/null\n      npm --version\n      npm i -g n > /dev/null\n      npm i -g semver > /dev/null\n      npm install --global yarn > /dev/null\n      n 20.8.0\n      node --version'
          : '# skipping toolchain setup in non-container provider'
      }
      ${setupHooks.filter((x) => x.hook.includes(`before`)).map((x) => x.commands) || ' '}
      export GITHUB_WORKSPACE="${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.repoPathAbsolute)}"
      ${isContainerized ? 'df -H /data/' : '# skipping df on /data in non-container provider'}
      export LOG_FILE=${isContainerized ? '/home/job-log.txt' : '$(pwd)/temp/job-log.txt'}
      ${BuildAutomationWorkflow.setupCommands(builderPath, isContainerized)}
      ${setupHooks.filter((x) => x.hook.includes(`after`)).map((x) => x.commands) || ' '}
      ${buildHooks.filter((x) => x.hook.includes(`before`)).map((x) => x.commands) || ' '}
      ${BuildAutomationWorkflow.BuildCommands(builderPath, isContainerized)}
      ${buildHooks.filter((x) => x.hook.includes(`after`)).map((x) => x.commands) || ' '}`;
  }

  private static setupCommands(builderPath: string, isContainerized: boolean) {
    const commands = `mkdir -p ${CloudRunnerFolders.ToLinuxFolder(
      CloudRunnerFolders.builderPathAbsolute,
    )} && git clone -q -b ${CloudRunner.buildParameters.cloudRunnerBranch} ${
      CloudRunnerFolders.unityBuilderRepoUrl
    } "${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.builderPathAbsolute)}" && chmod +x ${builderPath}`;

    if (isContainerized) {
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
echo "CACHE_KEY=$CACHE_KEY"
node ${builderPath} -m remote-cli-pre-build`;
    }

    return `export GIT_DISCOVERY_ACROSS_FILESYSTEM=1
mkdir -p "$(dirname "$LOG_FILE")"
echo "log start" >> "$LOG_FILE"
echo "CACHE_KEY=$CACHE_KEY"
node ${builderPath} -m remote-cli-pre-build`;
  }

  private static BuildCommands(builderPath: string, isContainerized: boolean) {
    const distFolder = path.join(CloudRunnerFolders.builderPathAbsolute, 'dist');
    const ubuntuPlatformsFolder = path.join(CloudRunnerFolders.builderPathAbsolute, 'dist', 'platforms', 'ubuntu');

    if (isContainerized) {
      return `
    mkdir -p ${`${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.projectBuildFolderAbsolute)}/build`}
    cd ${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.projectPathAbsolute)}
    cp -r "${CloudRunnerFolders.ToLinuxFolder(path.join(distFolder, 'default-build-script'))}" "/UnityBuilderAction"
    cp -r "${CloudRunnerFolders.ToLinuxFolder(path.join(ubuntuPlatformsFolder, 'entrypoint.sh'))}" "/entrypoint.sh"
    cp -r "${CloudRunnerFolders.ToLinuxFolder(path.join(ubuntuPlatformsFolder, 'steps'))}" "/steps"
    chmod -R +x "/entrypoint.sh"
    chmod -R +x "/steps"
    { echo "game ci start"; echo "game ci start" >> /home/job-log.txt; echo "CACHE_KEY=$CACHE_KEY"; if [ -n "$LOCKED_WORKSPACE" ]; then echo "Retained Workspace: true"; fi; if [ -n "$LOCKED_WORKSPACE" ] && [ -d "$GITHUB_WORKSPACE/.git" ]; then echo "Retained Workspace Already Exists!"; fi; /entrypoint.sh; } | node ${builderPath} -m remote-cli-log-stream --logFile /home/job-log.txt
    node ${builderPath} -m remote-cli-post-build`;
    }

    return `
    echo "game ci start"
    echo "game ci start" >> "$LOG_FILE"
    node ${builderPath} -m remote-cli-log-stream --logFile "$LOG_FILE"
    node ${builderPath} -m remote-cli-post-build`;
  }
}
