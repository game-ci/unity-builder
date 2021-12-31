import { BuildParameters, Input } from '../..';

export class CloudRunnerBuildCommandProcessor {
  public static ProcessCommands(commands: string, buildParameters: BuildParameters): string {
    return `echo "---"
      echo "start cloud runner init"
      ${Input.cloudRunnerTests ? '' : '#'} printenv
      echo "start cloud runner job"
      ${commands}
      echo "end of cloud runner job
      ---${buildParameters.logId}"
    `;
  }
}
