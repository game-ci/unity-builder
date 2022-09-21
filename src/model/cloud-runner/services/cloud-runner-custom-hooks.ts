import { BuildParameters } from '../..';
import YAML from 'yaml';
import CloudRunnerSecret from './cloud-runner-secret';
import CloudRunner from '../cloud-runner';

export class CloudRunnerCustomHooks {
  // TODO also accept hooks as yaml files in the repo
  public static ApplyHooksToCommands(commands: string, buildParameters: BuildParameters): string {
    const hooks = CloudRunnerCustomHooks.getHooks(buildParameters.customJobHooks).filter((x) => x.step.includes(`all`));

    return `echo "---"
      echo "start cloud runner init"
      ${CloudRunner.buildParameters.cloudRunnerIntegrationTests ? '' : '#'} printenv
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

  public static getSecrets(hooks) {
    return hooks.map((x) => x.secrets).filter((x) => x !== undefined && x.length > 0);
  }
}
export class Hook {
  public commands;
  public secrets: CloudRunnerSecret[] = new Array<CloudRunnerSecret>();
  public name;
  public hook!: string[];
  public step!: string[];
}
