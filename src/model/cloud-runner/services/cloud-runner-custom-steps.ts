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
import CloudRunnerOptions from '../cloud-runner-options';

export class CloudRunnerCustomSteps {
  static GetCustomStepsFromFiles(hookLifecycle: string): CustomStep[] {
    const results: CustomStep[] = [];
    RemoteClientLogger.log(`GetCustomStepFiles: ${hookLifecycle}`);
    try {
      const gameCiCustomStepsPath = path.join(process.cwd(), `game-ci`, `steps`);
      const files = fs.readdirSync(gameCiCustomStepsPath);
      for (const file of files) {
        if (!CloudRunnerOptions.customStepFiles.includes(file.replace(`.yaml`, ``))) {
          RemoteClientLogger.log(`Skipping CustomStepFile: ${file} (not in ${CloudRunnerOptions.customStepFiles})`);
          continue;
        }
        const fileContents = fs.readFileSync(path.join(gameCiCustomStepsPath, file), `utf8`);
        const fileContentsObject = CloudRunnerCustomSteps.ParseSteps(fileContents)[0];
        if (fileContentsObject.hook === hookLifecycle) {
          results.push(fileContentsObject);
        }
      }
    } catch (error) {
      RemoteClientLogger.log(`Failed Getting: ${hookLifecycle} \n ${JSON.stringify(error, undefined, 4)}`);
    }
    RemoteClientLogger.log(`Active Steps From Files: \n ${JSON.stringify(results, undefined, 4)}`);

    const builtInCustomSteps: CustomStep[] = CloudRunnerCustomSteps.ParseSteps(
      `- name: aws-s3-upload-build
  image: amazon/aws-cli
  hook: after
  commands: |
    printenv
    aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID --profile default
    aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY --profile default
    aws configure set region $AWS_DEFAULT_REGION --profile default
    aws s3 cp /data/cache/$CACHE_KEY/build/build-$BUILD_GUID.tar.lz4 s3://game-ci-test-storage/$CACHE_KEY/build-$BUILD_GUID.tar.lz4
  secrets:
  - name: awsAccessKeyId
    value: ${process.env.AWS_ACCESS_KEY_ID || ``}
  - name: awsSecretAccessKey
    value: ${process.env.AWS_SECRET_ACCESS_KEY || ``}
  - name: awsDefaultRegion
    value: ${process.env.AWS_REGION || ``}
- name: aws-s3-upload-cache
  image: amazon/aws-cli
  hook: after
  commands: |
    printenv
    aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID --profile default
    aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY --profile default
    aws configure set region $AWS_DEFAULT_REGION --profile default
    aws s3 cp --recursive /data/cache/$CACHE_KEY/ s3://game-ci-test-storage/$CACHE_KEY/
  secrets:
  - name: awsAccessKeyId
    value: ${process.env.AWS_ACCESS_KEY_ID || ``}
  - name: awsSecretAccessKey
    value: ${process.env.AWS_SECRET_ACCESS_KEY || ``}
  - name: awsDefaultRegion
    value: ${process.env.AWS_REGION || ``}
- name: aws-s3-pull-cache
  image: amazon/aws-cli
  hook: before
  commands: |
    printenv
    aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID --profile default
    aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY --profile default
    aws configure set region $AWS_DEFAULT_REGION --profile default
    BUCKET1="game-ci-test-storage/$CACHE_KEY/Library"
    OBJECT1="$(aws s3 ls $BUCKET1 --recursive | sort | tail -n 1 | awk '{print $4}')"
    aws s3 cp s3://$BUCKET1/$OBJECT1 /data/cache/$CACHE_KEY/Library/
    BUCKET2="game-ci-test-storage/$CACHE_KEY/lfs"
    OBJECT2="$(aws s3 ls $BUCKET2 --recursive | sort | tail -n 1 | awk '{print $4}')"
    aws s3 cp s3://$BUCKET2/$OBJECT2 /data/cache/$CACHE_KEY/lfs/
  secrets:
  - name: awsAccessKeyId
    value: ${process.env.AWS_ACCESS_KEY_ID || ``}
  - name: awsSecretAccessKey
    value: ${process.env.AWS_SECRET_ACCESS_KEY || ``}
  - name: awsDefaultRegion
    value: ${process.env.AWS_REGION || ``}
- name: debug-cache
  image: ubuntu
  hook: after
  commands: |
    apt-get update > /dev/null
    apt-get install -y tree > /dev/null
    printenv
    tree -L 3 /data/cache
  secrets:
  - name: awsAccessKeyId
    value: ${process.env.AWS_ACCESS_KEY_ID || ``}
  - name: awsSecretAccessKey
    value: ${process.env.AWS_SECRET_ACCESS_KEY || ``}
  - name: awsDefaultRegion
    value: ${process.env.AWS_REGION || ``}`,
    ).filter((x) => CloudRunnerOptions.customStepFiles.includes(x.name) && x.hook === hookLifecycle);
    if (builtInCustomSteps.length > 0) {
      results.push(...builtInCustomSteps);
    }

    return results;
  }

  private static ConvertYamlSecrets(object) {
    if (object.secrets === undefined) {
      object.secrets = [];

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

    // if (CloudRunner.buildParameters?.cloudRunnerIntegrationTests) {

    CloudRunnerLogger.log(`Parsing build steps: ${steps}`);

    // }
    const isArray = steps.replace(/\s/g, ``)[0] === `-`;
    const object: CustomStep[] = isArray ? YAML.parse(steps) : [YAML.parse(steps)];
    for (const step of object) {
      CloudRunnerCustomSteps.ConvertYamlSecrets(step);
      if (step.secrets === undefined) {
        step.secrets = [];
      }
      if (step.image === undefined) {
        step.image = `ubuntu`;
      }
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
  public hook!: string;
}
