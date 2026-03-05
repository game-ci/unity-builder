import * as core from '@actions/core';
import path from 'node:path';
import { Action, BuildParameters, Cache, Orchestrator, Docker, ImageTag, Output } from './model';
import { Cli } from './model/cli/cli';
import MacBuilder from './model/mac-builder';
import PlatformSetup from './model/platform-setup';
import { BuildReliabilityService } from './model/orchestrator/services/reliability';
import { TestWorkflowService } from './model/orchestrator/services/test-workflow';
import { HotRunnerService } from './model/orchestrator/services/hot-runner';
import { HotRunnerConfig } from './model/orchestrator/services/hot-runner/hot-runner-types';

async function runMain() {
  try {
    if (Cli.InitCliMode()) {
      await Cli.RunCli();

      return;
    }
    Action.checkCompatibility();
    Cache.verify();

    // Always configure git environment for CI reliability
    BuildReliabilityService.configureGitEnvironment();

    const { workspace, actionFolder } = Action;

    const buildParameters = await BuildParameters.create();

    // If a test suite path is provided, use the test workflow engine
    // instead of the standard build execution path
    if (buildParameters.testSuitePath) {
      core.info('[TestWorkflow] Test suite path detected, using test workflow engine');
      const results = await TestWorkflowService.executeTestSuite(buildParameters.testSuitePath, buildParameters);

      const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
      if (totalFailed > 0) {
        core.setFailed(`Test workflow completed with ${totalFailed} failure(s)`);
      } else {
        core.info('[TestWorkflow] All test runs passed');
      }

      return;
    }

    const baseImage = new ImageTag(buildParameters);

    // Pre-build reliability checks
    if (buildParameters.gitIntegrityCheck) {
      core.info('Running git integrity checks...');

      const isHealthy = BuildReliabilityService.checkGitIntegrity(workspace);
      BuildReliabilityService.cleanStaleLockFiles(workspace);
      BuildReliabilityService.validateSubmoduleBackingStores(workspace);

      if (buildParameters.cleanReservedFilenames) {
        BuildReliabilityService.cleanReservedFilenames(buildParameters.projectPath);
      }

      if (!isHealthy && buildParameters.gitAutoRecover) {
        core.info('Git corruption detected, attempting automatic recovery...');
        const recovered = BuildReliabilityService.recoverCorruptedRepo(workspace);
        if (!recovered) {
          core.warning('Automatic recovery failed. Build may encounter issues.');
        }
      }
    } else if (buildParameters.cleanReservedFilenames) {
      // cleanReservedFilenames can run independently of gitIntegrityCheck
      BuildReliabilityService.cleanReservedFilenames(buildParameters.projectPath);
    }

    let exitCode = -1;

    // Hot runner path: attempt to use a persistent Unity editor instance
    if (buildParameters.hotRunnerEnabled) {
      core.info('[HotRunner] Hot runner mode enabled, attempting hot build...');

      const hotRunnerConfig: HotRunnerConfig = {
        enabled: true,
        transport: buildParameters.hotRunnerTransport,
        host: buildParameters.hotRunnerHost,
        port: buildParameters.hotRunnerPort,
        healthCheckInterval: buildParameters.hotRunnerHealthInterval,
        maxIdleTime: buildParameters.hotRunnerMaxIdle,
        maxJobsBeforeRecycle: 0, // no automatic recycle by job count
      };

      const hotRunnerService = new HotRunnerService();

      try {
        await hotRunnerService.initialize(hotRunnerConfig);
        const result = await hotRunnerService.submitBuild(buildParameters, (output) => {
          core.info(output);
        });

        exitCode = result.exitCode;
        core.info(`[HotRunner] Build completed with exit code ${exitCode}`);
        await hotRunnerService.shutdown();
      } catch (hotRunnerError) {
        await hotRunnerService.shutdown();

        if (buildParameters.hotRunnerFallbackToCold) {
          core.warning(
            `[HotRunner] Hot runner failed: ${(hotRunnerError as Error).message}. Falling back to cold build.`,
          );
          exitCode = await runColdBuild(buildParameters, baseImage, workspace, actionFolder);
        } else {
          throw hotRunnerError;
        }
      }
    } else if (buildParameters.providerStrategy === 'local') {
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

      // Git hooks
      if (buildParameters.gitHooksEnabled) {
        const { GitHooksService } = await import('./model/orchestrator/services/hooks/git-hooks-service');
        await GitHooksService.installHooks(workspace);
        if (buildParameters.gitHooksSkipList) {
          const environment = GitHooksService.configureSkipList(buildParameters.gitHooksSkipList.split(','));
          Object.assign(process.env, environment);
        }
      } else {
        const { GitHooksService } = await import('./model/orchestrator/services/hooks/git-hooks-service');
        await GitHooksService.disableHooks(workspace);
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
      exitCode = await runColdBuild(buildParameters, baseImage, workspace, actionFolder);
    } else {
      await Orchestrator.run(buildParameters, baseImage.toString());
      exitCode = 0;
    }

    // Post-build: archive and enforce retention
    if (buildParameters.buildArchiveEnabled && exitCode === 0) {
      core.info('Archiving build output...');
      BuildReliabilityService.archiveBuildOutput(buildParameters.buildPath, buildParameters.buildArchivePath);
      BuildReliabilityService.enforceRetention(buildParameters.buildArchivePath, buildParameters.buildArchiveRetention);
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

async function runColdBuild(
  buildParameters: BuildParameters,
  baseImage: ImageTag,
  workspace: string,
  actionFolder: string,
): Promise<number> {
  if (buildParameters.providerStrategy === 'local') {
    core.info('Building locally');
    await PlatformSetup.setup(buildParameters, actionFolder);

    return process.platform === 'darwin'
      ? await MacBuilder.run(actionFolder)
      : await Docker.run(baseImage.toString(), {
          workspace,
          actionFolder,
          ...buildParameters,
        });
  } else {
    await Orchestrator.run(buildParameters, baseImage.toString());

    return 0;
  }
}

runMain();
