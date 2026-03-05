import * as core from '@actions/core';
import { Action, BuildParameters, Cache, Orchestrator, Docker, ImageTag, Output } from './model';
import { Cli } from './model/cli/cli';
import MacBuilder from './model/mac-builder';
import PlatformSetup from './model/platform-setup';
import { IncrementalSyncService } from './model/orchestrator/services/sync';
import { SyncStrategy } from './model/orchestrator/services/sync/sync-state';

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

      // Apply incremental sync strategy before build
      const syncStrategy = buildParameters.syncStrategy as SyncStrategy;
      if (syncStrategy !== 'full') {
        core.info(`[Sync] Applying sync strategy: ${syncStrategy}`);
        await applySyncStrategy(buildParameters, workspace);
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

      // Revert overlays after job completion if configured
      if (buildParameters.syncRevertAfter && syncStrategy !== 'full') {
        core.info('[Sync] Reverting overlay changes after job completion');
        try {
          await IncrementalSyncService.revertOverlays(workspace, buildParameters.syncStatePath);
        } catch (revertError) {
          core.warning(`[Sync] Overlay revert failed: ${(revertError as Error).message}`);
        }
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

/**
 * Apply the configured sync strategy to the workspace before build.
 */
async function applySyncStrategy(buildParameters: BuildParameters, workspace: string): Promise<void> {
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
