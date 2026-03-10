import * as core from '@actions/core';
import path from 'node:path';
import { Action, BuildParameters, Cache, Docker, ImageTag, Output } from './model';
import { Cli } from './model/cli/cli';
import MacBuilder from './model/mac-builder';
import PlatformSetup from './model/platform-setup';
import { loadOrchestrator, loadEnterpriseServices } from './model/orchestrator-plugin';
import { SyncStrategy } from './model/orchestrator/services/sync/sync-state';

type EnterpriseServices = Exclude<
  ReturnType<typeof loadEnterpriseServices> extends Promise<infer T> ? T : never,
  undefined
>;

async function runMain() {
  try {
    if (Cli.InitCliMode()) {
      await Cli.RunCli();

      return;
    }
    Action.checkCompatibility();
    Cache.verify();

    const enterprise = await loadEnterpriseServices();

    // Always configure git environment for CI reliability
    enterprise?.BuildReliabilityService.configureGitEnvironment();

    const { workspace, actionFolder } = Action;

    const buildParameters = await BuildParameters.create();

    // If a test suite path is provided, use the test workflow engine
    // instead of the standard build execution path
    if (buildParameters.testSuitePath) {
      core.info('[TestWorkflow] Test suite path detected, using test workflow engine');
      const results = await enterprise?.TestWorkflowService.executeTestSuite(
        buildParameters.testSuitePath,
        buildParameters,
      );

      let totalFailed = 0;
      for (const result of results || []) {
        totalFailed += result.failed;
      }

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

      const isHealthy = enterprise?.BuildReliabilityService.checkGitIntegrity(workspace);
      enterprise?.BuildReliabilityService.cleanStaleLockFiles(workspace);
      enterprise?.BuildReliabilityService.validateSubmoduleBackingStores(workspace);

      if (buildParameters.cleanReservedFilenames) {
        enterprise?.BuildReliabilityService.cleanReservedFilenames(buildParameters.projectPath);
      }

      if (!isHealthy && buildParameters.gitAutoRecover) {
        core.info('Git corruption detected, attempting automatic recovery...');
        const recovered = enterprise?.BuildReliabilityService.recoverCorruptedRepo(workspace);
        if (!recovered) {
          core.warning('Automatic recovery failed. Build may encounter issues.');
        }
      }
    } else if (buildParameters.cleanReservedFilenames) {
      // cleanReservedFilenames can run independently of gitIntegrityCheck
      enterprise?.BuildReliabilityService.cleanReservedFilenames(buildParameters.projectPath);
    }

    let exitCode = -1;

    // Hot runner path: attempt to use a persistent Unity editor instance
    if (buildParameters.hotRunnerEnabled) {
      core.info('[HotRunner] Hot runner mode enabled, attempting hot build...');

      const hotRunnerConfig = {
        enabled: true,
        transport: buildParameters.hotRunnerTransport,
        host: buildParameters.hotRunnerHost,
        port: buildParameters.hotRunnerPort,
        healthCheckInterval: buildParameters.hotRunnerHealthInterval,
        maxIdleTime: buildParameters.hotRunnerMaxIdle,
        maxJobsBeforeRecycle: 0, // no automatic recycle by job count
      };

      if (!enterprise?.HotRunnerService) {
        throw new Error('[HotRunner] Enterprise services required for hot runner mode');
      }

      const hotRunnerService = new enterprise.HotRunnerService();

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
        const ChildWorkspaceService = await enterprise?.loadChildWorkspaceService();
        const cacheRoot =
          buildParameters.childWorkspaceCacheRoot ||
          path.join(buildParameters.runnerTempPath || process.env.RUNNER_TEMP || '', 'game-ci-workspaces');
        childWorkspaceConfig = ChildWorkspaceService?.buildConfig({
          childWorkspacesEnabled: buildParameters.childWorkspacesEnabled,
          childWorkspaceName: buildParameters.childWorkspaceName,
          childWorkspaceCacheRoot: cacheRoot,
          childWorkspacePreserveGit: buildParameters.childWorkspacePreserveGit,
          childWorkspaceSeparateLibrary: buildParameters.childWorkspaceSeparateLibrary,
        });
        const projectFullPath = path.join(workspace, buildParameters.projectPath);
        const restored = ChildWorkspaceService?.initializeWorkspace(projectFullPath, childWorkspaceConfig);
        core.info(
          `Child workspace "${buildParameters.childWorkspaceName}": ${
            restored ? 'restored from cache' : 'starting fresh'
          }`,
        );

        // Log workspace size for resource tracking
        const size = ChildWorkspaceService?.getWorkspaceSize(projectFullPath);
        core.info(`Child workspace size after restore: ${size}`);
      }

      // Submodule profile initialization
      if (buildParameters.submoduleProfilePath) {
        core.info('Initializing submodules from profile...');
        const SubmoduleProfileService = await enterprise?.loadSubmoduleProfileService();
        const plan = await SubmoduleProfileService?.createInitPlan(
          buildParameters.submoduleProfilePath,
          buildParameters.submoduleVariantPath,
          workspace,
        );

        if (plan) {
          await SubmoduleProfileService?.execute(
            plan,
            workspace,
            buildParameters.submoduleToken || buildParameters.gitPrivateToken,
          );
        }
      }

      // Configure custom LFS transfer agent
      if (buildParameters.lfsTransferAgent) {
        core.info('Configuring custom LFS transfer agent...');
        const LfsAgentService = await enterprise?.loadLfsAgentService();
        await LfsAgentService?.configure(
          buildParameters.lfsTransferAgent,
          buildParameters.lfsTransferAgentArgs,
          buildParameters.lfsStoragePaths ? buildParameters.lfsStoragePaths.split(';') : [],
          workspace,
        );
      }

      // Local build caching - restore
      let cacheRoot = '';
      let cacheKey = '';
      // eslint-disable-next-line no-undef
      let LocalCacheService: Awaited<ReturnType<NonNullable<typeof enterprise>['loadLocalCacheService']>> | undefined;
      if (buildParameters.localCacheEnabled) {
        LocalCacheService = await enterprise?.loadLocalCacheService();
        cacheRoot = LocalCacheService?.resolveCacheRoot(buildParameters) || '';
        cacheKey =
          LocalCacheService?.generateCacheKey(
            buildParameters.targetPlatform,
            buildParameters.editorVersion,
            buildParameters.branch || '',
          ) || '';
        if (buildParameters.localCacheLfs) {
          await LocalCacheService?.restoreLfsCache(workspace, cacheRoot, cacheKey);
        }
        if (buildParameters.localCacheLibrary) {
          const projectFullPath = path.join(workspace, buildParameters.projectPath);
          await LocalCacheService?.restoreLibraryCache(projectFullPath, cacheRoot, cacheKey);
        }
      }

      // Git hooks — opt-in only. When disabled (default), do not touch hooks at all.
      if (buildParameters.gitHooksEnabled) {
        const GitHooksService = await enterprise?.loadGitHooksService();
        await GitHooksService?.installHooks(workspace);
        if (buildParameters.gitHooksSkipList) {
          const environment = GitHooksService?.configureSkipList(buildParameters.gitHooksSkipList.split(','));
          if (environment) {
            Object.assign(process.env, environment);
          }
        }
      }

      // Apply incremental sync strategy before build
      const syncStrategy = buildParameters.syncStrategy as SyncStrategy;
      if (syncStrategy !== 'full') {
        core.info(`[Sync] Applying sync strategy: ${syncStrategy}`);
        await applySyncStrategy(buildParameters, workspace, enterprise);
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
      if (buildParameters.localCacheEnabled && LocalCacheService) {
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
        const ChildWorkspaceService = await enterprise?.loadChildWorkspaceService();
        const projectFullPath = path.join(workspace, buildParameters.projectPath);
        const preSaveSize = ChildWorkspaceService?.getWorkspaceSize(projectFullPath);
        core.info(`Child workspace size before save: ${preSaveSize}`);

        ChildWorkspaceService?.saveWorkspace(projectFullPath, childWorkspaceConfig);
        core.info(`Child workspace "${buildParameters.childWorkspaceName}" saved to cache`);
      }

      // Revert overlays after job completion if configured
      if (buildParameters.syncRevertAfter && syncStrategy !== 'full') {
        core.info('[Sync] Reverting overlay changes after job completion');
        try {
          await enterprise?.IncrementalSyncService.revertOverlays(workspace, buildParameters.syncStatePath);
        } catch (revertError) {
          core.warning(`[Sync] Overlay revert failed: ${(revertError as Error).message}`);
        }
      }
    } else {
      const orchestrator = await loadOrchestrator();
      if (!orchestrator) {
        throw new Error(
          'Orchestrator package not available. Install @game-ci/orchestrator or use providerStrategy=local.',
        );
      }
      await orchestrator.run(buildParameters, baseImage.toString());
      exitCode = 0;
    }

    // Post-build: archive and enforce retention
    if (buildParameters.buildArchiveEnabled && exitCode === 0) {
      core.info('Archiving build output...');
      enterprise?.BuildReliabilityService.archiveBuildOutput(
        buildParameters.buildPath,
        buildParameters.buildArchivePath,
      );
      enterprise?.BuildReliabilityService.enforceRetention(
        buildParameters.buildArchivePath,
        buildParameters.buildArchiveRetention,
      );
    }

    // Set output
    await Output.setBuildVersion(buildParameters.buildVersion);
    await Output.setAndroidVersionCode(buildParameters.androidVersionCode);
    await Output.setEngineExitCode(exitCode);

    // Artifact collection and upload (runs on both success and failure)
    try {
      // Register custom output types if provided
      if (buildParameters.artifactCustomTypes) {
        try {
          const customTypes = JSON.parse(buildParameters.artifactCustomTypes);
          if (Array.isArray(customTypes)) {
            for (const ct of customTypes) {
              enterprise?.OutputTypeRegistry.registerType({
                name: ct.name,
                defaultPath: ct.defaultPath || ct.pattern || `./${ct.name}/`,
                description: ct.description || `Custom output type: ${ct.name}`,
                builtIn: false,
              });
            }
          }
        } catch (parseError) {
          core.warning(`Failed to parse artifactCustomTypes: ${(parseError as Error).message}`);
        }
      }

      // Collect outputs and generate manifest
      const manifestPath = path.join(buildParameters.projectPath, 'output-manifest.json');
      const manifest = await enterprise?.OutputService.collectOutputs(
        buildParameters.projectPath,
        buildParameters.buildGuid,
        buildParameters.artifactOutputTypes,
        manifestPath,
      );

      core.setOutput('artifactManifestPath', manifestPath);

      if (manifest) {
        // Upload artifacts
        const uploadConfig = enterprise?.ArtifactUploadHandler.parseConfig(
          buildParameters.artifactUploadTarget,
          buildParameters.artifactUploadPath || undefined,
          buildParameters.artifactCompression,
          buildParameters.artifactRetentionDays,
        );

        if (uploadConfig) {
          const uploadResult = await enterprise?.ArtifactUploadHandler.uploadArtifacts(
            manifest,
            uploadConfig,
            buildParameters.projectPath,
          );

          if (uploadResult && !uploadResult.success) {
            core.warning(
              `Artifact upload completed with errors: ${uploadResult.entries
                .filter((entry) => !entry.success)
                .map((entry) => `${entry.type}: ${entry.error}`)
                .join('; ')}`,
            );
          }
        }
      }
    } catch (artifactError) {
      core.warning(`Artifact collection/upload failed: ${(artifactError as Error).message}`);
    }

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
    const orchestrator = await loadOrchestrator();
    if (!orchestrator) {
      throw new Error(
        'Orchestrator package not available. Install @game-ci/orchestrator or use providerStrategy=local.',
      );
    }
    await orchestrator.run(buildParameters, baseImage.toString());

    return 0;
  }
}

/**
 * Apply the configured sync strategy to the workspace before build.
 */
async function applySyncStrategy(
  buildParameters: BuildParameters,
  workspace: string,
  enterprise?: EnterpriseServices | undefined,
): Promise<void> {
  if (!enterprise?.IncrementalSyncService) {
    core.warning('[Sync] Enterprise services not available, skipping sync strategy');

    return;
  }

  const { IncrementalSyncService } = enterprise;
  const strategy = buildParameters.syncStrategy as SyncStrategy;
  const resolvedStrategy = IncrementalSyncService.resolveStrategy(strategy, workspace, buildParameters.syncStatePath);

  if (resolvedStrategy === 'full') {
    core.info('[Sync] Resolved to full sync (no incremental state available)');

    return;
  }

  switch (resolvedStrategy) {
    case 'git-delta': {
      const targetReference = buildParameters.gitSha || buildParameters.branch;
      const changedFiles = await IncrementalSyncService.syncGitDelta(
        workspace,
        targetReference,
        buildParameters.syncStatePath,
      );
      core.info(`[Sync] Git delta sync applied: ${changedFiles} file(s) changed`);
      break;
    }
    case 'direct-input': {
      if (!buildParameters.syncInputRef) {
        throw new Error('[Sync] direct-input strategy requires syncInputRef to be set');
      }
      const overlays = await IncrementalSyncService.applyDirectInput(
        workspace,
        buildParameters.syncInputRef,
        buildParameters.syncStorageRemote || undefined,
        buildParameters.syncStatePath,
      );
      core.info(`[Sync] Direct input applied: ${overlays.length} overlay(s)`);
      break;
    }
    case 'storage-pull': {
      if (!buildParameters.syncInputRef) {
        throw new Error('[Sync] storage-pull strategy requires syncInputRef to be set');
      }
      const pulledFiles = await IncrementalSyncService.syncStoragePull(workspace, buildParameters.syncInputRef, {
        rcloneRemote: buildParameters.syncStorageRemote || undefined,
        syncRevertAfter: buildParameters.syncRevertAfter,
        statePath: buildParameters.syncStatePath,
      });
      core.info(`[Sync] Storage pull complete: ${pulledFiles.length} file(s)`);
      break;
    }
    default:
      core.warning(`[Sync] Unknown sync strategy: ${resolvedStrategy}`);
  }
}

runMain();
