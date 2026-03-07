import * as core from '@actions/core';
import path from 'node:path';
import { Action, BuildParameters, Cache, Orchestrator, Docker, ImageTag, Output } from './model';
import { Cli } from './model/cli/cli';
import MacBuilder from './model/mac-builder';
import PlatformSetup from './model/platform-setup';

async function runMain() {
  try {
    if (Cli.InitCliMode()) {
      await Cli.RunCli();

      return;
    }
    Action.checkCompatibility();
    Cache.verify();

    const { workspace, actionFolder } = Action;

    const buildParameters = await BuildParameters.create();
    const baseImage = new ImageTag(buildParameters);

    let exitCode = -1;

    if (buildParameters.providerStrategy === 'local') {
      core.info('Building locally');

      // Child workspace isolation - restore cached workspace before any other setup
      let childWorkspaceConfig: any;
      if (buildParameters.childWorkspacesEnabled && buildParameters.childWorkspaceName) {
        const { ChildWorkspaceService } = await import('./model/orchestrator/services/cache/child-workspace-service');
        const cacheRoot =
          buildParameters.childWorkspaceCacheRoot ||
          path.join(buildParameters.runnerTempPath || process.env.RUNNER_TEMP || '', 'game-ci-workspaces');
        childWorkspaceConfig = ChildWorkspaceService.buildConfig({
          childWorkspacesEnabled: buildParameters.childWorkspacesEnabled,
          childWorkspaceName: buildParameters.childWorkspaceName,
          childWorkspaceCacheRoot: cacheRoot,
          childWorkspacePreserveGit: buildParameters.childWorkspacePreserveGit,
          childWorkspaceSeparateLibrary: buildParameters.childWorkspaceSeparateLibrary,
        });
        const projectFullPath = path.join(workspace, buildParameters.projectPath);
        const restored = ChildWorkspaceService.initializeWorkspace(projectFullPath, childWorkspaceConfig);
        core.info(
          `Child workspace "${buildParameters.childWorkspaceName}": ${
            restored ? 'restored from cache' : 'starting fresh'
          }`,
        );

        // Log workspace size for resource tracking
        const size = ChildWorkspaceService.getWorkspaceSize(projectFullPath);
        core.info(`Child workspace size after restore: ${size}`);
      }

      // Submodule profile initialization
      if (buildParameters.submoduleProfilePath) {
        const { SubmoduleProfileService } = await import(
          './model/orchestrator/services/submodule/submodule-profile-service'
        );
        core.info('Initializing submodules from profile...');
        const plan = await SubmoduleProfileService.createInitPlan(
          buildParameters.submoduleProfilePath,
          buildParameters.submoduleVariantPath,
          workspace,
        );
        await SubmoduleProfileService.execute(
          plan,
          workspace,
          buildParameters.submoduleToken || buildParameters.gitPrivateToken,
        );
      }

      // Configure custom LFS transfer agent
      if (buildParameters.lfsTransferAgent) {
        const { LfsAgentService } = await import('./model/orchestrator/services/lfs/lfs-agent-service');
        core.info('Configuring custom LFS transfer agent...');
        await LfsAgentService.configure(
          buildParameters.lfsTransferAgent,
          buildParameters.lfsTransferAgentArgs,
          buildParameters.lfsStoragePaths ? buildParameters.lfsStoragePaths.split(';') : [],
          workspace,
        );
      }

      // Local build caching - restore
      let cacheRoot = '';
      let cacheKey = '';
      if (buildParameters.localCacheEnabled) {
        const { LocalCacheService } = await import('./model/orchestrator/services/cache/local-cache-service');
        cacheRoot = LocalCacheService.resolveCacheRoot(buildParameters);
        cacheKey = LocalCacheService.generateCacheKey(
          buildParameters.targetPlatform,
          buildParameters.editorVersion,
          buildParameters.branch || '',
        );
        if (buildParameters.localCacheLfs) {
          await LocalCacheService.restoreLfsCache(workspace, cacheRoot, cacheKey);
        }
        if (buildParameters.localCacheLibrary) {
          const projectFullPath = path.join(workspace, buildParameters.projectPath);
          await LocalCacheService.restoreLibraryCache(projectFullPath, cacheRoot, cacheKey);
        }
      }

      // Git hooks — opt-in only. When disabled (default), do not touch hooks at all.
      if (buildParameters.gitHooksEnabled) {
        const { GitHooksService } = await import('./model/orchestrator/services/hooks/git-hooks-service');
        await GitHooksService.installHooks(workspace);
        if (buildParameters.gitHooksSkipList) {
          const environment = GitHooksService.configureSkipList(buildParameters.gitHooksSkipList.split(','));
          Object.assign(process.env, environment);
        }
      }

      await PlatformSetup.setup(buildParameters, actionFolder);
      exitCode =
        process.platform === 'darwin'
          ? await MacBuilder.run(actionFolder)
          : await Docker.run(baseImage.toString(), {
              workspace,
              actionFolder,
              ...buildParameters,
            });

      // Local build caching - save
      if (buildParameters.localCacheEnabled) {
        const { LocalCacheService } = await import('./model/orchestrator/services/cache/local-cache-service');
        if (buildParameters.localCacheLibrary) {
          const projectFullPath = path.join(workspace, buildParameters.projectPath);
          await LocalCacheService.saveLibraryCache(projectFullPath, cacheRoot, cacheKey);
        }
        if (buildParameters.localCacheLfs) {
          await LocalCacheService.saveLfsCache(workspace, cacheRoot, cacheKey);
        }
      }

      // Child workspace isolation - save workspace for next run
      if (childWorkspaceConfig && childWorkspaceConfig.enabled) {
        const { ChildWorkspaceService } = await import('./model/orchestrator/services/cache/child-workspace-service');
        const projectFullPath = path.join(workspace, buildParameters.projectPath);
        const preSaveSize = ChildWorkspaceService.getWorkspaceSize(projectFullPath);
        core.info(`Child workspace size before save: ${preSaveSize}`);

        ChildWorkspaceService.saveWorkspace(projectFullPath, childWorkspaceConfig);
        core.info(`Child workspace "${buildParameters.childWorkspaceName}" saved to cache`);
      }
    } else {
      await Orchestrator.run(buildParameters, baseImage.toString());
      exitCode = 0;
    }

    // Set output
    await Output.setBuildVersion(buildParameters.buildVersion);
    await Output.setAndroidVersionCode(buildParameters.androidVersionCode);
    await Output.setEngineExitCode(exitCode);

    if (exitCode !== 0) {
      core.setFailed(`Build failed with exit code ${exitCode}`);
    }
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

runMain();
