import { BuildParameters, Input } from '../..';
import YAML from 'yaml';
import CloudRunnerSecret from './cloud-runner-secret';
import CloudRunnerLogger from './cloud-runner-logger';

export class CloudRunnerBuildCommandProcessor {
  public static ProcessCommands(commands: string, buildParameters: BuildParameters): string {
    let hooks = CloudRunnerBuildCommandProcessor.getHooks();

    if (Input.cloudRunnerTests) {
      CloudRunnerLogger.log(JSON.stringify(hooks, undefined, 4));
    } else {
      hooks = [];
    }

    return `echo "---"
      echo "start cloud runner init"
      ${Input.cloudRunnerTests ? '' : '#'} printenv
      echo "start cloud runner job"
      ${
        hooks
          .filter((x) => x.hook !== undefined && x.hook.length > 0 && x.hook.includes(`before`))
          .map((x) => x.commands)
          .join(`\n`) || ' '
      }
      ${commands}
      ${
        hooks
          .filter((x) => x.hook !== undefined && x.hook.length > 0 && x.hook.includes(`before`))
          .map((x) => x.commands)
          .join(`\n`) || ' '
      }
      echo "end of cloud runner job
      ---${buildParameters.logId}"
    `;
  }

  public static getHooks(): Hook[] {
    const experimentHooks = process.env.EXPERIMENTAL_HOOKS;
    let output = new Array<Hook>();
    if (experimentHooks && experimentHooks !== '') {
      try {
        output = YAML.parse(experimentHooks);
      } catch (error) {
        throw error;
      }
    }
    return output;
  }
}
export class Hook {
  public commands;
  public secrets: CloudRunnerSecret[] = [];
  public name;
  public hook;
}
