import { BuildParameters, Input } from '../..';

export class CloudRunnerBuildCommandProcessor {
  public static ProcessCommands(commands: string, buildParameters: BuildParameters): string {
    return `echo "---"
      ${Input.cloudRunnerTests ? '' : '#'} printenv
      echo "start"
      ${commands}
      echo "end---${buildParameters.logId}"
    `;
  }
}
