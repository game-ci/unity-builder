import { BuildParameters, Input } from '../../..';
import YAML from 'yaml';
import { RemoteClientLogger } from '../../remote-client/remote-client-logger';
import path from 'node:path';
import CloudRunnerOptions from '../../options/cloud-runner-options';
import * as fs from 'node:fs';
import CloudRunnerLogger from '../core/cloud-runner-logger';
import { CommandHook } from './command-hook';

// import CloudRunnerLogger from './cloud-runner-logger';

export class CommandHookService {
  public static ApplyHooksToCommands(commands: string, buildParameters: BuildParameters): string {
    const hooks = CommandHookService.getHooks(buildParameters.commandHooks);
    CloudRunnerLogger.log(`Applying hooks ${hooks.length}`);

    return `echo "---"
echo "start cloud runner init"
${CloudRunnerOptions.cloudRunnerDebug ? `printenv` : `#`}
echo "start of cloud runner job"
${hooks.filter((x) => x.hook.includes(`before`)).map((x) => x.commands) || ' '}
${commands}
${hooks.filter((x) => x.hook.includes(`after`)).map((x) => x.commands) || ' '}
echo "end of cloud runner job"
echo "---${buildParameters.logId}"`;
  }

  public static getHooks(customCommandHooks: string): CommandHook[] {
    const experimentHooks = customCommandHooks;
    let output = new Array<CommandHook>();
    if (experimentHooks && experimentHooks !== '') {
      try {
        output = YAML.parse(experimentHooks);
      } catch (error) {
        throw error;
      }
    }

    return [
      ...output.filter((x) => x.hook !== undefined && x.hook.length > 0),
      ...CommandHookService.GetCustomHooksFromFiles(`before`),
      ...CommandHookService.GetCustomHooksFromFiles(`after`),
    ];
  }

  static GetCustomHooksFromFiles(hookLifecycle: string): CommandHook[] {
    const results: CommandHook[] = [];

    // RemoteClientLogger.log(`GetCustomHookFiles: ${hookLifecycle}`);
    try {
      const gameCiCustomHooksPath = path.join(process.cwd(), `game-ci`, `command-hooks`);
      const files = fs.readdirSync(gameCiCustomHooksPath);
      for (const file of files) {
        if (!CloudRunnerOptions.commandHookFiles.includes(file.replace(`.yaml`, ``))) {
          continue;
        }
        const fileContents = fs.readFileSync(path.join(gameCiCustomHooksPath, file), `utf8`);
        const fileContentsObject = CommandHookService.ParseHooks(fileContents)[0];
        if (fileContentsObject.hook.includes(hookLifecycle)) {
          results.push(fileContentsObject);
        }
      }
    } catch (error) {
      RemoteClientLogger.log(`Failed Getting: ${hookLifecycle} \n ${JSON.stringify(error, undefined, 4)}`);
    }

    // RemoteClientLogger.log(`Active Steps From Hooks: \n ${JSON.stringify(results, undefined, 4)}`);

    return results;
  }

  private static ConvertYamlSecrets(object: CommandHook) {
    if (object.secrets === undefined) {
      object.secrets = [];

      return;
    }
    object.secrets = object.secrets.map((x: any) => {
      return {
        ParameterKey: x.name,
        EnvironmentVariable: Input.ToEnvVarFormat(x.name),
        ParameterValue: x.value,
      };
    });
  }

  public static ParseHooks(hooks: string): CommandHook[] {
    if (hooks === '') {
      return [];
    }

    // if (CloudRunner.buildParameters?.cloudRunnerIntegrationTests) {

    // CloudRunnerLogger.log(`Parsing build hooks: ${steps}`);

    // }
    const isArray = hooks.replace(/\s/g, ``)[0] === `-`;
    const object: CommandHook[] = isArray ? YAML.parse(hooks) : [YAML.parse(hooks)];
    for (const hook of object) {
      CommandHookService.ConvertYamlSecrets(hook);
      if (hook.secrets === undefined) {
        hook.secrets = [];
      }
    }
    if (object === undefined) {
      throw new Error(`Failed to parse ${hooks}`);
    }

    return object;
  }

  public static getSecrets(hooks: any) {
    const secrets = hooks.map((x: any) => x.secrets).filter((x: any) => x !== undefined && x.length > 0);

    // eslint-disable-next-line unicorn/no-array-reduce
    return secrets.length > 0 ? secrets.reduce((x: any, y: any) => [...x, ...y]) : [];
  }
}
