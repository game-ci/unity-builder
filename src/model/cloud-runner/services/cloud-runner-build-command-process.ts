import { BuildParameters } from '../..';

export class CloudRunnerBuildCommandProcessor {
  public static ProcessCommands(commands: string, buildParameters: BuildParameters): string {
    return `echo "---"
      echo "start"
      ${CloudRunnerBuildCommandProcessor.GetSecrets(buildParameters)}
      ${commands}
      echo "end--${buildParameters.logId}"
    `;
  }
  static GetSecrets(buildParameters: BuildParameters) {
    return buildParameters.cloudRunnerCluster === `k8s`
      ? `for f in /credentials; do cat $f | base64 && echo $f; done`
      : ``;
  }
}
