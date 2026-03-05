import * as core from '@actions/core';
import { Action, BuildParameters, Cache, Orchestrator, Docker, ImageTag, Output } from './model';
import { Cli } from './model/cli/cli';
import MacBuilder from './model/mac-builder';
import PlatformSetup from './model/platform-setup';
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
      exitCode = await runColdBuild(buildParameters, baseImage, workspace, actionFolder);
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
