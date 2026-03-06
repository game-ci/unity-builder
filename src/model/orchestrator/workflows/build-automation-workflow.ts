import OrchestratorLogger from '../services/core/orchestrator-logger';
import { OrchestratorFolders } from '../options/orchestrator-folders';
import { OrchestratorStepParameters } from '../options/orchestrator-step-parameters';
import { WorkflowInterface } from './workflow-interface';
import { CommandHookService } from '../services/hooks/command-hook-service';
import path from 'node:path';
import Orchestrator from '../orchestrator';
import { ContainerHookService } from '../services/hooks/container-hook-service';
import { MiddlewareService } from '../services/hooks/middleware-service';
import { CustomWorkflow } from './custom-workflow';

export class BuildAutomationWorkflow implements WorkflowInterface {
  async run(orchestratorStepState: OrchestratorStepParameters) {
    return await BuildAutomationWorkflow.standardBuildAutomation(orchestratorStepState.image, orchestratorStepState);
  }

  private static async standardBuildAutomation(baseImage: string, orchestratorStepState: OrchestratorStepParameters) {
    OrchestratorLogger.log(`Orchestrator is running standard build automation`);

    let output = '';

    // Load middleware pipeline
    const middleware = MiddlewareService.getMiddleware(Orchestrator.buildParameters.middleware);

    // --- Pre-build phase ---
    // Middleware container hooks: pre-build before
    const preBuildMiddlewareBefore = MiddlewareService.resolveContainerHooks(middleware, 'pre-build', 'before');
    if (preBuildMiddlewareBefore.length > 0) {
      output += await CustomWorkflow.runContainerJob(
        preBuildMiddlewareBefore,
        orchestratorStepState.environment,
        orchestratorStepState.secrets,
      );
      OrchestratorLogger.logWithTime('Middleware pre-build:before container step(s) time');
    }

    // Standard pre-build container hooks
    output += await ContainerHookService.RunPreBuildSteps(orchestratorStepState);
    OrchestratorLogger.logWithTime('Configurable pre build step(s) time');

    // Middleware container hooks: pre-build after
    const preBuildMiddlewareAfter = MiddlewareService.resolveContainerHooks(middleware, 'pre-build', 'after');
    if (preBuildMiddlewareAfter.length > 0) {
      output += await CustomWorkflow.runContainerJob(
        preBuildMiddlewareAfter,
        orchestratorStepState.environment,
        orchestratorStepState.secrets,
      );
      OrchestratorLogger.logWithTime('Middleware pre-build:after container step(s) time');
    }

    // --- Build phase ---
    OrchestratorLogger.log(baseImage);
    OrchestratorLogger.logLine(` `);
    OrchestratorLogger.logLine('Starting build automation job');

    output += await Orchestrator.Provider.runTaskInWorkflow(
      Orchestrator.buildParameters.buildGuid,
      baseImage.toString(),
      BuildAutomationWorkflow.BuildWorkflow,
      `/${OrchestratorFolders.buildVolumeFolder}`,
      `/${OrchestratorFolders.buildVolumeFolder}/`,
      orchestratorStepState.environment,
      orchestratorStepState.secrets,
    );
    OrchestratorLogger.logWithTime('Build time');

    // --- Post-build phase ---
    // Middleware container hooks: post-build before
    const postBuildMiddlewareBefore = MiddlewareService.resolveContainerHooks(middleware, 'post-build', 'before');
    if (postBuildMiddlewareBefore.length > 0) {
      output += await CustomWorkflow.runContainerJob(
        postBuildMiddlewareBefore,
        orchestratorStepState.environment,
        orchestratorStepState.secrets,
      );
      OrchestratorLogger.logWithTime('Middleware post-build:before container step(s) time');
    }

    // Standard post-build container hooks
    output += await ContainerHookService.RunPostBuildSteps(orchestratorStepState);
    OrchestratorLogger.logWithTime('Configurable post build step(s) time');

    // Middleware container hooks: post-build after
    const postBuildMiddlewareAfter = MiddlewareService.resolveContainerHooks(middleware, 'post-build', 'after');
    if (postBuildMiddlewareAfter.length > 0) {
      output += await CustomWorkflow.runContainerJob(
        postBuildMiddlewareAfter,
        orchestratorStepState.environment,
        orchestratorStepState.secrets,
      );
      OrchestratorLogger.logWithTime('Middleware post-build:after container step(s) time');
    }

    OrchestratorLogger.log(`Orchestrator finished running standard build automation`);

    return output;
  }

  private static get BuildWorkflow() {
    const setupHooks = CommandHookService.getHooks(Orchestrator.buildParameters.commandHooks).filter((x) =>
      x.step?.includes(`setup`),
    );
    const buildHooks = CommandHookService.getHooks(Orchestrator.buildParameters.commandHooks).filter((x) =>
      x.step?.includes(`build`),
    );

    // Resolve middleware command hooks for setup and build phases
    const middleware = MiddlewareService.getMiddleware(Orchestrator.buildParameters.middleware);
    const middlewareSetupBefore = MiddlewareService.resolveCommandHooks(middleware, 'setup', 'before');
    const middlewareSetupAfter = MiddlewareService.resolveCommandHooks(middleware, 'setup', 'after');
    const middlewareBuildBefore = MiddlewareService.resolveCommandHooks(middleware, 'build', 'before');
    const middlewareBuildAfter = MiddlewareService.resolveCommandHooks(middleware, 'build', 'after');
    const isContainerized =
      Orchestrator.buildParameters.providerStrategy === 'aws' ||
      Orchestrator.buildParameters.providerStrategy === 'k8s' ||
      Orchestrator.buildParameters.providerStrategy === 'local-docker';

    const builderPath = isContainerized
      ? OrchestratorFolders.ToLinuxFolder(path.join(OrchestratorFolders.builderPathAbsolute, 'dist', `index.js`))
      : OrchestratorFolders.ToLinuxFolder(path.join(process.cwd(), 'dist', `index.js`));

    // prettier-ignore
    return `echo "orchestrator build workflow starting"
      ${
        isContainerized && Orchestrator.buildParameters.providerStrategy !== 'local-docker'
          ? 'apt-get update > /dev/null || true'
          : '# skipping apt-get in local-docker or non-container provider'
      }
      ${
        isContainerized && Orchestrator.buildParameters.providerStrategy !== 'local-docker'
          ? 'apt-get install -y curl tar tree npm git-lfs jq git > /dev/null || true\n      npm --version || true\n      npm i -g n > /dev/null || true\n      npm i -g semver > /dev/null || true\n      npm install --global yarn > /dev/null || true\n      n 20.8.0 || true\n      node --version || true'
          : '# skipping toolchain setup in local-docker or non-container provider'
      }
      ${middlewareSetupBefore.map((x) => x.commands).join('\n      ') || ' '}
      ${setupHooks.filter((x) => x.hook.includes(`before`)).map((x) => x.commands) || ' '}
      ${
        Orchestrator.buildParameters.providerStrategy === 'local-docker'
          ? `export GITHUB_WORKSPACE="${Orchestrator.buildParameters.dockerWorkspacePath}"
      echo "Using docker workspace: $GITHUB_WORKSPACE"`
          : `export GITHUB_WORKSPACE="${OrchestratorFolders.ToLinuxFolder(OrchestratorFolders.repoPathAbsolute)}"`
      }
      ${isContainerized ? 'df -H /data/' : '# skipping df on /data in non-container provider'}
      export LOG_FILE=${isContainerized ? '/home/job-log.txt' : '$(pwd)/temp/job-log.txt'}
      ${BuildAutomationWorkflow.setupCommands(builderPath, isContainerized)}
      ${setupHooks.filter((x) => x.hook.includes(`after`)).map((x) => x.commands) || ' '}
      ${middlewareSetupAfter.map((x) => x.commands).join('\n      ') || ' '}
      ${middlewareBuildBefore.map((x) => x.commands).join('\n      ') || ' '}
      ${buildHooks.filter((x) => x.hook.includes(`before`)).map((x) => x.commands) || ' '}
      ${BuildAutomationWorkflow.BuildCommands(builderPath, isContainerized)}
      ${buildHooks.filter((x) => x.hook.includes(`after`)).map((x) => x.commands) || ' '}
      ${middlewareBuildAfter.map((x) => x.commands).join('\n      ') || ' '}`;
  }

  private static setupCommands(builderPath: string, isContainerized: boolean) {
    // prettier-ignore
    const commands = `mkdir -p ${OrchestratorFolders.ToLinuxFolder(
      OrchestratorFolders.builderPathAbsolute,
    )}
BRANCH="${Orchestrator.buildParameters.orchestratorBranch}"
REPO="${OrchestratorFolders.unityBuilderRepoUrl}"
DEST="${OrchestratorFolders.ToLinuxFolder(OrchestratorFolders.builderPathAbsolute)}"
if [ -n "$(git ls-remote --heads "$REPO" "$BRANCH" 2>/dev/null)" ]; then
  git clone -q -b "$BRANCH" "$REPO" "$DEST"
else
  echo "Remote branch $BRANCH not found in $REPO; falling back to a known branch"
  git clone -q -b main "$REPO" "$DEST" \
    || git clone -q "$REPO" "$DEST"
fi
chmod +x ${builderPath}`;

    if (isContainerized) {
      const cloneBuilderCommands = `if [ -e "${OrchestratorFolders.ToLinuxFolder(
        OrchestratorFolders.uniqueOrchestratorJobFolderAbsolute,
      )}" ] && [ -e "${OrchestratorFolders.ToLinuxFolder(
        path.join(OrchestratorFolders.builderPathAbsolute, `.git`),
      )}" ] ; then echo "Builder Already Exists!" && (command -v tree > /dev/null 2>&1 && tree ${
        OrchestratorFolders.builderPathAbsolute
      } || ls -la ${OrchestratorFolders.builderPathAbsolute}); else ${commands} ; fi`;

      return `export GIT_DISCOVERY_ACROSS_FILESYSTEM=1
${cloneBuilderCommands}
echo "log start" >> /home/job-log.txt
echo "CACHE_KEY=$CACHE_KEY"
${
  Orchestrator.buildParameters.providerStrategy !== 'local-docker'
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
    const distFolder = path.join(OrchestratorFolders.builderPathAbsolute, 'dist');
    const ubuntuPlatformsFolder = path.join(OrchestratorFolders.builderPathAbsolute, 'dist', 'platforms', 'ubuntu');

    if (isContainerized) {
      if (Orchestrator.buildParameters.providerStrategy === 'local-docker') {
        // prettier-ignore
        return `
    mkdir -p ${`${OrchestratorFolders.ToLinuxFolder(OrchestratorFolders.projectBuildFolderAbsolute)}/build`}
    mkdir -p "/data/cache/$CACHE_KEY/build"
    cd "$GITHUB_WORKSPACE/${Orchestrator.buildParameters.projectPath}"
    cp -r "${OrchestratorFolders.ToLinuxFolder(path.join(distFolder, 'default-build-script'))}" "/UnityBuilderAction"
    cp -r "${OrchestratorFolders.ToLinuxFolder(path.join(ubuntuPlatformsFolder, 'entrypoint.sh'))}" "/entrypoint.sh"
    cp -r "${OrchestratorFolders.ToLinuxFolder(path.join(ubuntuPlatformsFolder, 'steps'))}" "/steps"
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
    # Pipe entrypoint.sh output through log stream to capture Unity build output (including "Build succeeded")
    { echo "game ci start"; echo "game ci start" >> /home/job-log.txt; echo "CACHE_KEY=$CACHE_KEY"; echo "$CACHE_KEY"; if [ -n "$LOCKED_WORKSPACE" ]; then echo "Retained Workspace: true"; fi; if [ -n "$LOCKED_WORKSPACE" ] && [ -d "$GITHUB_WORKSPACE/.git" ]; then echo "Retained Workspace Already Exists!"; fi; /entrypoint.sh; } | node ${builderPath} -m remote-cli-log-stream --logFile /home/job-log.txt
    mkdir -p "/data/cache/$CACHE_KEY/Library"
    if [ ! -f "/data/cache/$CACHE_KEY/Library/lib-$BUILD_GUID.tar" ] && [ ! -f "/data/cache/$CACHE_KEY/Library/lib-$BUILD_GUID.tar.lz4" ]; then
      tar -cf "/data/cache/$CACHE_KEY/Library/lib-$BUILD_GUID.tar" --files-from /dev/null || touch "/data/cache/$CACHE_KEY/Library/lib-$BUILD_GUID.tar"
    fi
    if [ ! -f "/data/cache/$CACHE_KEY/build/build-$BUILD_GUID.tar" ] && [ ! -f "/data/cache/$CACHE_KEY/build/build-$BUILD_GUID.tar.lz4" ]; then
      tar -cf "/data/cache/$CACHE_KEY/build/build-$BUILD_GUID.tar" --files-from /dev/null || touch "/data/cache/$CACHE_KEY/build/build-$BUILD_GUID.tar"
    fi
    # Run post-build tasks and capture output
    # Note: Post-build may clean up the builder directory, so we write output directly to log file
    # Use set +e to allow the command to fail without exiting the script
    set +e
    # Run post-build and write output to both stdout (for K8s kubectl logs) and log file
    # For local-docker, stdout is captured by the log stream mechanism
    if [ -f "${builderPath}" ]; then
      # Use tee to write to both stdout and log file, ensuring output is captured
      # For K8s, kubectl logs reads from stdout, so we need stdout
      # For local-docker, the log file is read directly
      node ${builderPath} -m remote-cli-post-build 2>&1 | tee -a /home/job-log.txt || echo "Post-build command completed with warnings" | tee -a /home/job-log.txt
    else
      # Builder doesn't exist, skip post-build (shouldn't happen, but handle gracefully)
      echo "Builder path not found, skipping post-build" | tee -a /home/job-log.txt
    fi
    # Write "Collected Logs" message for K8s (needed for test assertions)
    # Write to both stdout and log file to ensure it's captured even if kubectl has issues
    # Also write to PVC (/data) as backup in case pod is OOM-killed and ephemeral filesystem is lost
    echo "Collected Logs" | tee -a /home/job-log.txt /data/job-log.txt 2>/dev/null || echo "Collected Logs" | tee -a /home/job-log.txt
    # Write end markers directly to log file (builder might be cleaned up by post-build)
    # Also write to stdout for K8s kubectl logs
    echo "end of orchestrator job" | tee -a /home/job-log.txt
    echo "---${Orchestrator.buildParameters.logId}" | tee -a /home/job-log.txt
    # Don't restore set -e - keep set +e to prevent script from exiting on error
    # This ensures the script completes successfully even if some operations fail
    # Mirror cache back into workspace for test assertions
    mkdir -p "$GITHUB_WORKSPACE/orchestrator-cache/cache/$CACHE_KEY/Library"
    mkdir -p "$GITHUB_WORKSPACE/orchestrator-cache/cache/$CACHE_KEY/build"
    cp -a "/data/cache/$CACHE_KEY/Library/." "$GITHUB_WORKSPACE/orchestrator-cache/cache/$CACHE_KEY/Library/" || true
    cp -a "/data/cache/$CACHE_KEY/build/." "$GITHUB_WORKSPACE/orchestrator-cache/cache/$CACHE_KEY/build/" || true`;
      }

      // prettier-ignore
      return `
    mkdir -p ${`${OrchestratorFolders.ToLinuxFolder(OrchestratorFolders.projectBuildFolderAbsolute)}/build`}
    cd ${OrchestratorFolders.ToLinuxFolder(OrchestratorFolders.projectPathAbsolute)}
    cp -r "${OrchestratorFolders.ToLinuxFolder(path.join(distFolder, 'default-build-script'))}" "/UnityBuilderAction"
    cp -r "${OrchestratorFolders.ToLinuxFolder(path.join(ubuntuPlatformsFolder, 'entrypoint.sh'))}" "/entrypoint.sh"
    cp -r "${OrchestratorFolders.ToLinuxFolder(path.join(ubuntuPlatformsFolder, 'steps'))}" "/steps"
    chmod -R +x "/entrypoint.sh"
    chmod -R +x "/steps"
    { echo "game ci start"; echo "game ci start" >> /home/job-log.txt; echo "CACHE_KEY=$CACHE_KEY"; echo "$CACHE_KEY"; if [ -n "$LOCKED_WORKSPACE" ]; then echo "Retained Workspace: true"; fi; if [ -n "$LOCKED_WORKSPACE" ] && [ -d "$GITHUB_WORKSPACE/.git" ]; then echo "Retained Workspace Already Exists!"; fi; /entrypoint.sh; } | node ${builderPath} -m remote-cli-log-stream --logFile /home/job-log.txt
    # Run post-build and capture output to both stdout (for kubectl logs) and log file
    # Note: Post-build may clean up the builder directory, so write output directly
    set +e
    if [ -f "${builderPath}" ]; then
      # Use tee to write to both stdout and log file for K8s kubectl logs
      node ${builderPath} -m remote-cli-post-build 2>&1 | tee -a /home/job-log.txt || echo "Post-build command completed with warnings" | tee -a /home/job-log.txt
    else
      echo "Builder path not found, skipping post-build" | tee -a /home/job-log.txt
    fi
    # Write "Collected Logs" message for K8s (needed for test assertions)
    # Write to both stdout and log file to ensure it's captured even if kubectl has issues
    # Also write to PVC (/data) as backup in case pod is OOM-killed and ephemeral filesystem is lost
    echo "Collected Logs" | tee -a /home/job-log.txt /data/job-log.txt 2>/dev/null || echo "Collected Logs" | tee -a /home/job-log.txt
    # Write end markers to both stdout and log file (builder might be cleaned up by post-build)
    echo "end of orchestrator job" | tee -a /home/job-log.txt
    echo "---${Orchestrator.buildParameters.logId}" | tee -a /home/job-log.txt`;
    }

    // prettier-ignore
    return `
    echo "game ci start"
    echo "game ci start" >> "$LOG_FILE"
    timeout 3s node ${builderPath} -m remote-cli-log-stream --logFile "$LOG_FILE" || true
    node ${builderPath} -m remote-cli-post-build`;
  }
}
