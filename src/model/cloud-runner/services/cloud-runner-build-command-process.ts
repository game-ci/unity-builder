import { BuildParameters } from '../..';

export class CloudRunnerBuildCommandProcessor {
  public static ProcessCommands(commands: string, buildParameters: BuildParameters): string {
    return `echo "---"
      echo "start"
      ${commands}
      echo "end---${buildParameters.logId}"
    `;
  }
}
