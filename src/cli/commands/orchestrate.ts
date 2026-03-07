import type { CommandModule } from 'yargs';
import * as core from '@actions/core';
import { BuildParameters, ImageTag, Orchestrator } from '../../model';
import { mapCliArgumentsToInput, CliArguments } from '../input-mapper';
import { withProjectOptions, withOrchestratorOptions } from './shared-options';

interface OrchestrateArguments extends CliArguments {
  targetPlatform: string;
  providerStrategy?: string;
}

const orchestrateCommand: CommandModule<object, OrchestrateArguments> = {
  command: ['orchestrate', 'o'],
  describe: 'Run a build via orchestrator providers (AWS, Kubernetes, etc.)',
  builder: (yargs) => {
    let y = withProjectOptions(yargs);
    y = withOrchestratorOptions(y);

    return y
      .option('versioning', {
        type: 'string',
        description: 'The versioning scheme to use',
        default: 'None',
      })
      .example(
        'game-ci orchestrate --target-platform StandaloneLinux64 --provider-strategy aws',
        'Build on AWS using the orchestrator',
      )
      .example(
        'game-ci o --target-platform StandaloneLinux64 --provider-strategy k8s --kube-config <base64>',
        'Build on Kubernetes (short alias)',
      ) as any;
  },
  handler: async (cliArguments) => {
    try {
      mapCliArgumentsToInput(cliArguments);

      const buildParameters = await BuildParameters.create();
      const baseImage = new ImageTag(buildParameters);

      core.info(`Orchestrating build via ${buildParameters.providerStrategy}...`);
      core.info(`Target platform: ${buildParameters.targetPlatform}`);
      core.info(`Unity version: ${buildParameters.editorVersion}`);
      core.info(`Build GUID: ${buildParameters.buildGuid}`);

      const result = await Orchestrator.run(buildParameters, baseImage.toString());

      core.info(`\nOrchestrated build completed.`);
      if (result?.BuildResults) {
        core.info(`Results: ${result.BuildResults}`);
      } else {
        core.warning('Build completed but no build results were returned.');
      }
    } catch (error: any) {
      core.setFailed(`Orchestrated build failed: ${error.message}`);

      throw error;
    }
  },
};

export default orchestrateCommand;
