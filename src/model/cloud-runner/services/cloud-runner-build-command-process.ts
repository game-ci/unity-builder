export class CloudRunnerBuildCommandProcessor {
  public static ProcessCommands(commands: string): string {
    return `
    echo "start"
    ${commands}
    echo "end"`;
  }
}
