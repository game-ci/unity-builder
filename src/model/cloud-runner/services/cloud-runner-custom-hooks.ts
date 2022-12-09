import { BuildParameters, Input } from '../..';
import YAML from 'yaml';
import CloudRunnerSecret from './cloud-runner-secret';
import { RemoteClientLogger } from '../remote-client/remote-client-logger';
import path from 'path';
import CloudRunnerOptions from '../cloud-runner-options';
import * as fs from 'fs';

// import CloudRunnerLogger from './cloud-runner-logger';

export class CloudRunnerCustomHooks {
  // TODO also accept hooks as yaml files in the repo
  public static ApplyHooksToCommands(commands: string, buildParameters: BuildParameters): string {
    const hooks = CloudRunnerCustomHooks.getHooks(buildParameters.customJobHooks).filter((x) => x.step.includes(`all`));

    return `echo "---"
      echo "start cloud runner init"
      ${CloudRunnerOptions.cloudRunnerDebugEnv ? `printenv` : `#`}
      echo "start of cloud runner job"
      ${hooks.filter((x) => x.hook.includes(`before`)).map((x) => x.commands) || ' '}
      ${commands}
      ${hooks.filter((x) => x.hook.includes(`after`)).map((x) => x.commands) || ' '}
      echo "end of cloud runner job"
      echo "---${buildParameters.logId}"`;
  }

  public static getHooks(customJobHooks): Hook[] {
    const experimentHooks = customJobHooks;
    let output = new Array<Hook>();
    if (experimentHooks && experimentHooks !== '') {
      try {
        output = YAML.parse(experimentHooks);
      } catch (error) {
        throw error;
      }
    }

    return output.filter((x) => x.step !== undefined && x.hook !== undefined && x.hook.length > 0);
  }

  static GetCustomHooksFromFiles(hookLifecycle: string): Hook[] {
    const results: Hook[] = [];
    RemoteClientLogger.log(`GetCustomStepFiles: ${hookLifecycle}`);
    try {
      const gameCiCustomStepsPath = path.join(process.cwd(), `game-ci`, `hooks`);
      const files = fs.readdirSync(gameCiCustomStepsPath);
      for (const file of files) {
        if (!CloudRunnerOptions.customHookFiles.includes(file.replace(`.yaml`, ``))) {
          continue;
        }
        const fileContents = fs.readFileSync(path.join(gameCiCustomStepsPath, file), `utf8`);
        const fileContentsObject = CloudRunnerCustomHooks.ParseHooks(fileContents)[0];
        if (fileContentsObject.hook.includes(hookLifecycle)) {
          results.push(fileContentsObject);
        }
      }
    } catch (error) {
      RemoteClientLogger.log(`Failed Getting: ${hookLifecycle} \n ${JSON.stringify(error, undefined, 4)}`);
    }
    RemoteClientLogger.log(`Active Steps From Files: \n ${JSON.stringify(results, undefined, 4)}`);

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

  public static ParseHooks(steps: string): Hook[] {
    if (steps === '') {
      return [];
    }

    // if (CloudRunner.buildParameters?.cloudRunnerIntegrationTests) {

    // CloudRunnerLogger.log(`Parsing build hooks: ${steps}`);

    // }
    const isArray = steps.replace(/\s/g, ``)[0] === `-`;
    const object: Hook[] = isArray ? YAML.parse(steps) : [YAML.parse(steps)];
    for (const hook of object) {
      CloudRunnerCustomHooks.ConvertYamlSecrets(hook);
      if (hook.secrets === undefined) {
        hook.secrets = [];
      }
    }
    if (object === undefined) {
      throw new Error(`Failed to parse ${steps}`);
    }

    return object;
  }

  public static getSecrets(hooks) {
    const secrets = hooks.map((x) => x.secrets).filter((x) => x !== undefined && x.length > 0);

    // eslint-disable-next-line unicorn/no-array-reduce
    return secrets.length > 0 ? secrets.reduce((x, y) => [...x, ...y]) : [];
  }
}
export class Hook {
  public commands;
  public secrets: CloudRunnerSecret[] = new Array<CloudRunnerSecret>();
  public name;
  public hook!: string[];
  public step!: string[];
}
