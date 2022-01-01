import { BuildParameters, Input } from '../..';
import YAML from 'yaml';
import CloudRunnerSecret from './cloud-runner-secret';
import CloudRunnerLogger from './cloud-runner-logger';

export class CloudRunnerBuildCommandProcessor {
  public static ProcessCommands(commands: string, buildParameters: BuildParameters): string {
    const hooks = CloudRunnerBuildCommandProcessor.getHooks().filter((x) => x.step.includes(`all`));

    return `echo "---"
      echo "start cloud runner init"
      ${Input.cloudRunnerTests ? '' : '#'} printenv
      echo "start cloud runner job"
      ${hooks.filter((x) => x.hook.includes(`before`)).map((x) => x.commands) || ' '}
      ${commands}
      ${hooks.filter((x) => x.hook.includes(`after`)).map((x) => x.commands) || ' '}
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
    if (Input.cloudRunnerTests) {
      CloudRunnerLogger.log(`Getting hooks: ${JSON.stringify(output, undefined, 4)}`);
    }
    return output.filter((x) => x.step !== undefined && x.hook !== undefined && x.hook.length > 0);
  }
}
export class Hook {
  public commands;
  public secrets: CloudRunnerSecret[] = [];
  public name;
  public hook!: string[];
  public step!: string[];
}
