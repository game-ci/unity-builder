import YAML from 'yaml';
import CloudRunner from '../../cloud-runner';
import { CustomWorkflow } from '../../workflows/custom-workflow';
import { RemoteClientLogger } from '../../remote-client/remote-client-logger';
import path from 'node:path';
import fs from 'node:fs';
import Input from '../../../input';
import CloudRunnerOptions from '../../options/cloud-runner-options';
import { ContainerHook as ContainerHook } from './container-hook';
import { CloudRunnerStepParameters } from '../../options/cloud-runner-step-parameters';

export class ContainerHookService {
  static GetContainerHooksFromFiles(hookLifecycle: string): ContainerHook[] {
    const results: ContainerHook[] = [];
    try {
      const gameCiCustomStepsPath = path.join(process.cwd(), `game-ci`, `container-hooks`);
      const files = fs.readdirSync(gameCiCustomStepsPath);
      for (const file of files) {
        if (!CloudRunnerOptions.containerHookFiles.includes(file.replace(`.yaml`, ``))) {
          // RemoteClientLogger.log(`Skipping CustomStepFile: ${file}`);
          continue;
        }
        const fileContents = fs.readFileSync(path.join(gameCiCustomStepsPath, file), `utf8`);
        const fileContentsObject = ContainerHookService.ParseContainerHooks(fileContents)[0];
        if (fileContentsObject.hook === hookLifecycle) {
          results.push(fileContentsObject);
        }
      }
    } catch (error) {
      RemoteClientLogger.log(`Failed Getting: ${hookLifecycle} \n ${JSON.stringify(error, undefined, 4)}`);
    }

    // RemoteClientLogger.log(`Active Steps From Files: \n ${JSON.stringify(results, undefined, 4)}`);

    const builtInContainerHooks: ContainerHook[] = ContainerHookService.ParseContainerHooks(
      `- name: aws-s3-upload-build
  image: amazon/aws-cli
  hook: after
  commands: |
    aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID --profile default
    aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY --profile default
    aws configure set region $AWS_DEFAULT_REGION --profile default
    aws s3 cp /data/cache/$CACHE_KEY/build/build-${CloudRunner.buildParameters.buildGuid}.tar${
        CloudRunner.buildParameters.useCompressionStrategy ? '.lz4' : ''
      } s3://${CloudRunner.buildParameters.awsStackName}/cloud-runner-cache/$CACHE_KEY/build/build-$BUILD_GUID.tar${
        CloudRunner.buildParameters.useCompressionStrategy ? '.lz4' : ''
      }
    rm /data/cache/$CACHE_KEY/build/build-${CloudRunner.buildParameters.buildGuid}.tar${
        CloudRunner.buildParameters.useCompressionStrategy ? '.lz4' : ''
      }
  secrets:
  - name: awsAccessKeyId
    value: ${process.env.AWS_ACCESS_KEY_ID || ``}
  - name: awsSecretAccessKey
    value: ${process.env.AWS_SECRET_ACCESS_KEY || ``}
  - name: awsDefaultRegion
    value: ${process.env.AWS_REGION || ``}
- name: aws-s3-pull-build
  image: amazon/aws-cli
  commands: |
    aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID --profile default
    aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY --profile default
    aws configure set region $AWS_DEFAULT_REGION --profile default
    aws s3 ls ${CloudRunner.buildParameters.awsStackName}/cloud-runner-cache/ || true
    aws s3 ls ${CloudRunner.buildParameters.awsStackName}/cloud-runner-cache/$CACHE_KEY/build || true
    mkdir -p /data/cache/$CACHE_KEY/build/
    aws s3 cp s3://${
      CloudRunner.buildParameters.awsStackName
    }/cloud-runner-cache/$CACHE_KEY/build/build-$BUILD_GUID_TARGET.tar${
        CloudRunner.buildParameters.useCompressionStrategy ? '.lz4' : ''
      } /data/cache/$CACHE_KEY/build/build-$BUILD_GUID_TARGET.tar${
        CloudRunner.buildParameters.useCompressionStrategy ? '.lz4' : ''
      }
  secrets:
    - name: AWS_ACCESS_KEY_ID
    - name: AWS_SECRET_ACCESS_KEY
    - name: AWS_DEFAULT_REGION
    - name: BUILD_GUID_TARGET
- name: steam-deploy-client
  image: steamcmd/steamcmd
  commands: |
    apt-get update
    apt-get install -y curl tar coreutils git tree > /dev/null
    curl -s https://gist.githubusercontent.com/frostebite/1d56f5505b36b403b64193b7a6e54cdc/raw/fa6639ed4ef750c4268ea319d63aa80f52712ffb/deploy-client-steam.sh | bash
  secrets:
    - name: STEAM_USERNAME
    - name: STEAM_PASSWORD
    - name: STEAM_APPID
    - name: STEAM_SSFN_FILE_NAME
    - name: STEAM_SSFN_FILE_CONTENTS
    - name: STEAM_CONFIG_VDF_1
    - name: STEAM_CONFIG_VDF_2
    - name: STEAM_CONFIG_VDF_3
    - name: STEAM_CONFIG_VDF_4
    - name: BUILD_GUID_TARGET
    - name: RELEASE_BRANCH
- name: steam-deploy-project
  image: steamcmd/steamcmd
  commands: |
    apt-get update
    apt-get install -y curl tar coreutils git tree > /dev/null
    curl -s https://gist.githubusercontent.com/frostebite/969da6a41002a0e901174124b643709f/raw/02403e53fb292026cba81ddcf4ff35fc1eba111d/steam-deploy-project.sh | bash
  secrets:
    - name: STEAM_USERNAME
    - name: STEAM_PASSWORD
    - name: STEAM_APPID
    - name: STEAM_SSFN_FILE_NAME
    - name: STEAM_SSFN_FILE_CONTENTS
    - name: STEAM_CONFIG_VDF_1
    - name: STEAM_CONFIG_VDF_2
    - name: STEAM_CONFIG_VDF_3
    - name: STEAM_CONFIG_VDF_4
    - name: BUILD_GUID_2
    - name: RELEASE_BRANCH
- name: aws-s3-upload-cache
  image: amazon/aws-cli
  hook: after
  commands: |
    aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID --profile default
    aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY --profile default
    aws configure set region $AWS_DEFAULT_REGION --profile default
    aws s3 cp --recursive /data/cache/$CACHE_KEY/lfs s3://${
      CloudRunner.buildParameters.awsStackName
    }/cloud-runner-cache/$CACHE_KEY/lfs
    rm -r /data/cache/$CACHE_KEY/lfs
    aws s3 cp --recursive /data/cache/$CACHE_KEY/Library s3://${
      CloudRunner.buildParameters.awsStackName
    }/cloud-runner-cache/$CACHE_KEY/Library
    rm -r /data/cache/$CACHE_KEY/Library
  secrets:
  - name: AWS_ACCESS_KEY_ID
    value: ${process.env.AWS_ACCESS_KEY_ID || ``}
  - name: AWS_SECRET_ACCESS_KEY
    value: ${process.env.AWS_SECRET_ACCESS_KEY || ``}
  - name: AWS_DEFAULT_REGION
    value: ${process.env.AWS_REGION || ``}
- name: aws-s3-pull-cache
  image: amazon/aws-cli
  hook: before
  commands: |
    aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID --profile default
    aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY --profile default
    aws configure set region $AWS_DEFAULT_REGION --profile default
    mkdir -p /data/cache/$CACHE_KEY/Library/
    mkdir -p /data/cache/$CACHE_KEY/lfs/
    aws s3 ls ${CloudRunner.buildParameters.awsStackName}/cloud-runner-cache/ || true
    aws s3 ls ${CloudRunner.buildParameters.awsStackName}/cloud-runner-cache/$CACHE_KEY/ || true
    BUCKET1="${CloudRunner.buildParameters.awsStackName}/cloud-runner-cache/$CACHE_KEY/Library/"
    aws s3 ls $BUCKET1 || true
    OBJECT1="$(aws s3 ls $BUCKET1 | sort | tail -n 1 | awk '{print $4}' || '')"
    aws s3 cp s3://$BUCKET1$OBJECT1 /data/cache/$CACHE_KEY/Library/ || true
    BUCKET2="${CloudRunner.buildParameters.awsStackName}/cloud-runner-cache/$CACHE_KEY/lfs/"
    aws s3 ls $BUCKET2 || true
    OBJECT2="$(aws s3 ls $BUCKET2 | sort | tail -n 1 | awk '{print $4}' || '')"
    aws s3 cp s3://$BUCKET2$OBJECT2 /data/cache/$CACHE_KEY/lfs/ || true
  secrets:
  - name: AWS_ACCESS_KEY_ID
    value: ${process.env.AWS_ACCESS_KEY_ID || ``}
  - name: AWS_SECRET_ACCESS_KEY
    value: ${process.env.AWS_SECRET_ACCESS_KEY || ``}
  - name: AWS_DEFAULT_REGION
    value: ${process.env.AWS_REGION || ``}
- name: debug-cache
  image: ubuntu
  hook: after
  commands: |
    apt-get update > /dev/null
    ${CloudRunnerOptions.cloudRunnerDebug ? `apt-get install -y tree > /dev/null` : `#`}
    ${CloudRunnerOptions.cloudRunnerDebug ? `tree -L 3 /data/cache` : `#`}
  secrets:
  - name: awsAccessKeyId
    value: ${process.env.AWS_ACCESS_KEY_ID || ``}
  - name: awsSecretAccessKey
    value: ${process.env.AWS_SECRET_ACCESS_KEY || ``}
  - name: awsDefaultRegion
    value: ${process.env.AWS_REGION || ``}`,
    ).filter((x) => CloudRunnerOptions.containerHookFiles.includes(x.name) && x.hook === hookLifecycle);
    if (builtInContainerHooks.length > 0) {
      results.push(...builtInContainerHooks);
    }

    return results;
  }

  private static ConvertYamlSecrets(object: ContainerHook) {
    if (object.secrets === undefined) {
      object.secrets = [];

      return;
    }
    object.secrets = object.secrets.map((x: { [key: string]: any }) => {
      return {
        ParameterKey: x.name,
        EnvironmentVariable: Input.ToEnvVarFormat(x.name),
        ParameterValue: x.value,
      };
    });
  }

  public static ParseContainerHooks(steps: string): ContainerHook[] {
    if (steps === '') {
      return [];
    }
    const isArray = steps.replace(/\s/g, ``)[0] === `-`;
    const object: ContainerHook[] = isArray ? YAML.parse(steps) : [YAML.parse(steps)];
    for (const step of object) {
      ContainerHookService.ConvertYamlSecrets(step);
      if (step.secrets === undefined) {
        step.secrets = [];
      } else {
        for (const secret of step.secrets) {
          if (secret.ParameterValue === undefined && process.env[secret.EnvironmentVariable] !== undefined) {
            if (CloudRunner.buildParameters?.cloudRunnerDebug) {
              // CloudRunnerLogger.log(`Injecting custom step ${step.name} from env var ${secret.ParameterKey}`);
            }
            secret.ParameterValue = process.env[secret.ParameterKey] || ``;
          }
        }
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

  static async RunPostBuildSteps(cloudRunnerStepState: CloudRunnerStepParameters) {
    let output = ``;
    const steps: ContainerHook[] = [
      ...ContainerHookService.ParseContainerHooks(CloudRunner.buildParameters.postBuildContainerHooks),
      ...ContainerHookService.GetContainerHooksFromFiles(`after`),
    ];

    if (steps.length > 0) {
      output += await CustomWorkflow.runContainerJob(
        steps,
        cloudRunnerStepState.environment,
        cloudRunnerStepState.secrets,
      );
    }

    return output;
  }
  static async RunPreBuildSteps(cloudRunnerStepState: CloudRunnerStepParameters) {
    let output = ``;
    const steps: ContainerHook[] = [
      ...ContainerHookService.ParseContainerHooks(CloudRunner.buildParameters.preBuildContainerHooks),
      ...ContainerHookService.GetContainerHooksFromFiles(`before`),
    ];

    if (steps.length > 0) {
      output += await CustomWorkflow.runContainerJob(
        steps,
        cloudRunnerStepState.environment,
        cloudRunnerStepState.secrets,
      );
    }

    return output;
  }
}
