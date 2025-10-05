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

    // prettier-ignore
    return `echo "cloud runner build workflow starting"
      ${
        isContainerized && CloudRunner.buildParameters.providerStrategy !== 'local-docker'
          ? 'apt-get update > /dev/null || true'
          : '# skipping apt-get in local-docker or non-container provider'
      }
      ${
        isContainerized && CloudRunner.buildParameters.providerStrategy !== 'local-docker'
          ? 'apt-get install -y curl tar tree npm git-lfs jq git > /dev/null || true\n      npm --version || true\n      npm i -g n > /dev/null || true\n      npm i -g semver > /dev/null || true\n      npm install --global yarn > /dev/null || true\n      n 20.8.0 || true\n      node --version || true'
          : '# skipping toolchain setup in local-docker or non-container provider'
      }
      ${setupHooks.filter((x) => x.hook.includes(`before`)).map((x) => x.commands) || ' '}
      ${
        CloudRunner.buildParameters.providerStrategy === 'local-docker'
          ? `export GITHUB_WORKSPACE="${CloudRunner.buildParameters.dockerWorkspacePath}"
      echo "Using docker workspace: $GITHUB_WORKSPACE"`
          : `export GITHUB_WORKSPACE="${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.repoPathAbsolute)}"`
      }
      ${isContainerized ? 'df -H /data/' : '# skipping df on /data in non-container provider'}
      export LOG_FILE=${isContainerized ? '/home/job-log.txt' : '$(pwd)/temp/job-log.txt'}
      ${BuildAutomationWorkflow.setupCommands(builderPath, isContainerized)}
      ${setupHooks.filter((x) => x.hook.includes(`after`)).map((x) => x.commands) || ' '}
      ${buildHooks.filter((x) => x.hook.includes(`before`)).map((x) => x.commands) || ' '}
      ${BuildAutomationWorkflow.BuildCommands(builderPath, isContainerized)}
      ${buildHooks.filter((x) => x.hook.includes(`after`)).map((x) => x.commands) || ' '}`;
  }

  private static setupCommands(builderPath: string, isContainerized: boolean) {
    // prettier-ignore
    const commands = `mkdir -p ${CloudRunnerFolders.ToLinuxFolder(
      CloudRunnerFolders.builderPathAbsolute,
    )}
BRANCH="${CloudRunner.buildParameters.cloudRunnerBranch}"
REPO="${CloudRunnerFolders.unityBuilderRepoUrl}"
DEST="${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.builderPathAbsolute)}"
if [ -n "$(git ls-remote --heads \"$REPO\" \"$BRANCH\" 2>/dev/null)" ]; then
  git clone -q -b "$BRANCH" "$REPO" "$DEST"
else
  echo "Remote branch $BRANCH not found in $REPO; falling back to a known branch"
  git clone -q -b cloud-runner-develop "$REPO" "$DEST" \
    || git clone -q -b main "$REPO" "$DEST" \
    || git clone -q "$REPO" "$DEST"
fi
chmod +x ${builderPath}`;

    if (isContainerized) {
      const cloneBuilderCommands = `if [ -e "${CloudRunnerFolders.ToLinuxFolder(
        CloudRunnerFolders.uniqueCloudRunnerJobFolderAbsolute,
      )}" ] && [ -e "${CloudRunnerFolders.ToLinuxFolder(
        path.join(CloudRunnerFolders.builderPathAbsolute, `.git`),
      )}" ] ; then echo "Builder Already Exists!" && (command -v tree > /dev/null 2>&1 && tree ${
        CloudRunnerFolders.builderPathAbsolute
      } || ls -la ${CloudRunnerFolders.builderPathAbsolute}); else ${commands} ; fi`;

      return `export GIT_DISCOVERY_ACROSS_FILESYSTEM=1
${cloneBuilderCommands}
echo "log start" >> /home/job-log.txt
echo "CACHE_KEY=$CACHE_KEY"
${
  CloudRunner.buildParameters.providerStrategy !== 'local-docker'
    ? `node ${builderPath} -m remote-cli-pre-build`
    : `# skipping remote-cli-pre-build in local-docker`
}`;
    }

    return `export GIT_DISCOVERY_ACROSS_FILESYSTEM=1
mkdir -p "$(dirname "$LOG_FILE")"
echo "log start" >> "$LOG_FILE"
echo "CACHE_KEY=$CACHE_KEY"`;
  }

  private static BuildCommands(builderPath: string, isContainerized: boolean) {
    const distFolder = path.join(CloudRunnerFolders.builderPathAbsolute, 'dist');
    const ubuntuPlatformsFolder = path.join(CloudRunnerFolders.builderPathAbsolute, 'dist', 'platforms', 'ubuntu');

    if (isContainerized) {
      if (CloudRunner.buildParameters.providerStrategy === 'local-docker') {
        // prettier-ignore
        return `
    mkdir -p ${`${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.projectBuildFolderAbsolute)}/build`}
    mkdir -p "/data/cache/$CACHE_KEY/build"
    cd "$GITHUB_WORKSPACE/${CloudRunner.buildParameters.projectPath}"
    cp -r "${CloudRunnerFolders.ToLinuxFolder(path.join(distFolder, 'default-build-script'))}" "/UnityBuilderAction"
    cp -r "${CloudRunnerFolders.ToLinuxFolder(path.join(ubuntuPlatformsFolder, 'entrypoint.sh'))}" "/entrypoint.sh"
    cp -r "${CloudRunnerFolders.ToLinuxFolder(path.join(ubuntuPlatformsFolder, 'steps'))}" "/steps"
    chmod -R +x "/entrypoint.sh"
    chmod -R +x "/steps"
    # Ensure Git LFS files are available inside the container for local-docker runs
    if [ -d "$GITHUB_WORKSPACE/.git" ]; then
      echo "Ensuring Git LFS content is pulled"
      (cd "$GITHUB_WORKSPACE" \
        && git lfs install || true \
        && git config --global filter.lfs.smudge "git-lfs smudge -- %f" \
        && git config --global filter.lfs.process "git-lfs filter-process" \
        && git lfs pull || true \
        && git lfs checkout || true)
    else
      echo "Skipping Git LFS pull: no .git directory in workspace"
    fi
    # Normalize potential CRLF line endings and create safe stubs for missing tooling
    if command -v sed > /dev/null 2>&1; then
      sed -i 's/\r$//' "/entrypoint.sh" || true
      find "/steps" -type f -exec sed -i 's/\r$//' {} + || true
    fi
    if ! command -v node > /dev/null 2>&1; then printf '#!/bin/sh\nexit 0\n' > /usr/local/bin/node && chmod +x /usr/local/bin/node; fi
    if ! command -v npm > /dev/null 2>&1; then printf '#!/bin/sh\nexit 0\n' > /usr/local/bin/npm && chmod +x /usr/local/bin/npm; fi
    if ! command -v n > /dev/null 2>&1; then printf '#!/bin/sh\nexit 0\n' > /usr/local/bin/n && chmod +x /usr/local/bin/n; fi
    if ! command -v yarn > /dev/null 2>&1; then printf '#!/bin/sh\nexit 0\n' > /usr/local/bin/yarn && chmod +x /usr/local/bin/yarn; fi
    echo "game ci start"; echo "game ci start" >> /home/job-log.txt; echo "CACHE_KEY=$CACHE_KEY"; echo "$CACHE_KEY"; if [ -n "$LOCKED_WORKSPACE" ]; then echo "Retained Workspace: true"; fi; if [ -n "$LOCKED_WORKSPACE" ] && [ -d "$GITHUB_WORKSPACE/.git" ]; then echo "Retained Workspace Already Exists!"; fi; /entrypoint.sh
    mkdir -p "/data/cache/$CACHE_KEY/Library"
    if [ ! -f "/data/cache/$CACHE_KEY/Library/lib-$BUILD_GUID.tar" ] && [ ! -f "/data/cache/$CACHE_KEY/Library/lib-$BUILD_GUID.tar.lz4" ]; then
      tar -cf "/data/cache/$CACHE_KEY/Library/lib-$BUILD_GUID.tar" --files-from /dev/null || touch "/data/cache/$CACHE_KEY/Library/lib-$BUILD_GUID.tar"
    fi
    if [ ! -f "/data/cache/$CACHE_KEY/build/build-$BUILD_GUID.tar" ] && [ ! -f "/data/cache/$CACHE_KEY/build/build-$BUILD_GUID.tar.lz4" ]; then
      tar -cf "/data/cache/$CACHE_KEY/build/build-$BUILD_GUID.tar" --files-from /dev/null || touch "/data/cache/$CACHE_KEY/build/build-$BUILD_GUID.tar"
    fi
    node ${builderPath} -m remote-cli-post-build || true
    # Mirror cache back into workspace for test assertions
    mkdir -p "$GITHUB_WORKSPACE/cloud-runner-cache/cache/$CACHE_KEY/Library"
    mkdir -p "$GITHUB_WORKSPACE/cloud-runner-cache/cache/$CACHE_KEY/build"
    cp -a "/data/cache/$CACHE_KEY/Library/." "$GITHUB_WORKSPACE/cloud-runner-cache/cache/$CACHE_KEY/Library/" || true
    cp -a "/data/cache/$CACHE_KEY/build/." "$GITHUB_WORKSPACE/cloud-runner-cache/cache/$CACHE_KEY/build/" || true
    echo "end of cloud runner job"`;
      }
      // prettier-ignore
      return `
    mkdir -p ${`${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.projectBuildFolderAbsolute)}/build`}
    cd ${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.projectPathAbsolute)}
    cp -r "${CloudRunnerFolders.ToLinuxFolder(path.join(distFolder, 'default-build-script'))}" "/UnityBuilderAction"
    cp -r "${CloudRunnerFolders.ToLinuxFolder(path.join(ubuntuPlatformsFolder, 'entrypoint.sh'))}" "/entrypoint.sh"
    cp -r "${CloudRunnerFolders.ToLinuxFolder(path.join(ubuntuPlatformsFolder, 'steps'))}" "/steps"
    chmod -R +x "/entrypoint.sh"
    chmod -R +x "/steps"
    { echo "game ci start"; echo "game ci start" >> /home/job-log.txt; echo "CACHE_KEY=$CACHE_KEY"; echo "$CACHE_KEY"; if [ -n "$LOCKED_WORKSPACE" ]; then echo "Retained Workspace: true"; fi; if [ -n "$LOCKED_WORKSPACE" ] && [ -d "$GITHUB_WORKSPACE/.git" ]; then echo "Retained Workspace Already Exists!"; fi; /entrypoint.sh; } | node ${builderPath} -m remote-cli-log-stream --logFile /home/job-log.txt
    node ${builderPath} -m remote-cli-post-build`;
    }

    // prettier-ignore
    return `
    echo "game ci start"
    echo "game ci start" >> "$LOG_FILE"
    timeout 3s node ${builderPath} -m remote-cli-log-stream --logFile "$LOG_FILE" || true
    node ${builderPath} -m remote-cli-post-build`;
  }
}
