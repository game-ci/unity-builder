import * as core from '@actions/core';
import { Action, BuildParameters, Cache, Orchestrator, Docker, ImageTag, Output } from './model';
import { Cli } from './model/cli/cli';
import MacBuilder from './model/mac-builder';
import PlatformSetup from './model/platform-setup';
import { TestWorkflowService } from './model/orchestrator/services/test-workflow';

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

    if (buildParameters.providerStrategy === 'local') {
      core.info('Building locally');
      await PlatformSetup.setup(buildParameters, actionFolder);
      exitCode =
        process.platform === 'darwin'
          ? await MacBuilder.run(actionFolder)
          : await Docker.run(baseImage.toString(), {
              workspace,
              actionFolder,
              ...buildParameters,
            });
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
