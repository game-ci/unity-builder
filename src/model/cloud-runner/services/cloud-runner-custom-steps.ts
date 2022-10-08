import YAML from 'yaml';
import CloudRunnerSecret from './cloud-runner-secret';
import CloudRunner from '../cloud-runner';
import * as core from '@actions/core';
import { CustomWorkflow } from '../workflows/custom-workflow';
import { RemoteClientLogger } from '../remote-client/remote-client-logger';
import path from 'path';
import * as fs from 'fs';
import CloudRunnerLogger from './cloud-runner-logger';
import Input from '../../input';

export class CloudRunnerCustomSteps {
  static GetCustomStepsFromFiles(hookLifecycle: string): CustomStep[] {
    const results: CustomStep[] = [];
    RemoteClientLogger.log(`GetCustomStepFiles: ${hookLifecycle}`);
    try {
      const gameCiCustomStepsPath = path.join(process.cwd(), `game-ci`, `steps`);
      const files = fs.readdirSync(gameCiCustomStepsPath);
      for (const file of files) {
        const fileContents = fs.readFileSync(path.join(gameCiCustomStepsPath, file), `utf8`);
        const fileContentsObject = YAML.parse(fileContents.toString());
        if (fileContentsObject.hook === hookLifecycle) {
          RemoteClientLogger.log(`Active Step File ${file} contents: ${fileContents}`);
          results.push(...CloudRunnerCustomSteps.ParseSteps(fileContents));
        }
      }
    } catch (error) {
      RemoteClientLogger.log(`Failed Getting: ${hookLifecycle} \n ${JSON.stringify(error, undefined, 4)}`);
    }

    return results;
  }

  private static ConvertYamlSecrets(object) {
    if (object.secrets === undefined) {
      return;
    }
    object.secrets = object.secrets.map((x) => {
      return {
        ParameterKey: x.name,
        EnvironmentVariable: Input.ToEnvVarFormat(x.name),
        ParameterValue: x.value,
      };
    });
  }

  public static ParseSteps(steps: string): CustomStep[] {
    if (steps === '') {
      return [];
    }
    if (CloudRunner.buildParameters.cloudRunnerIntegrationTests) {
      CloudRunnerLogger.log(`Parsing build steps: ${steps}`);
    }
    const isArray = steps[0] === `-`;
    const object: CustomStep[] = isArray ? YAML.parse(steps) : [YAML.parse(steps)];
    if (isArray) {
      for (const step of object) {
        CloudRunnerCustomSteps.ConvertYamlSecrets(step);
      }
    } else {
      CloudRunnerCustomSteps.ConvertYamlSecrets(object);
    }
    if (object === undefined) {
      throw new Error(`Failed to parse ${steps}`);
    }

    return object;
  }

  static async RunPostBuildSteps(cloudRunnerStepState) {
    let output = ``;
    const steps: CustomStep[] = [
      ...CloudRunnerCustomSteps.ParseSteps(CloudRunner.buildParameters.postBuildSteps),
      ...CloudRunnerCustomSteps.GetCustomStepsFromFiles(`after`),
    ];

    if (steps.length > 0) {
      if (!CloudRunner.buildParameters.isCliMode) core.startGroup('post build steps');
      output += await CustomWorkflow.runCustomJob(
        steps,
        cloudRunnerStepState.environment,
        cloudRunnerStepState.secrets,
      );
      if (!CloudRunner.buildParameters.isCliMode) core.endGroup();
    }

    return output;
  }
  static async RunPreBuildSteps(cloudRunnerStepState) {
    let output = ``;
    const steps: CustomStep[] = [
      ...CloudRunnerCustomSteps.ParseSteps(CloudRunner.buildParameters.preBuildSteps),
      ...CloudRunnerCustomSteps.GetCustomStepsFromFiles(`before`),
    ];

    if (steps.length > 0) {
      if (!CloudRunner.buildParameters.isCliMode) core.startGroup('pre build steps');
      output += await CustomWorkflow.runCustomJob(
        steps,
        cloudRunnerStepState.environment,
        cloudRunnerStepState.secrets,
      );
      if (!CloudRunner.buildParameters.isCliMode) core.endGroup();
    }

    return output;
  }
}
export class CustomStep {
  public commands;
  public secrets: CloudRunnerSecret[] = new Array<CloudRunnerSecret>();
  public name;
  public image: string = `ubuntu`;
  public hook!: string[];
}
