export class EngineDetector {
  private projectPath: string;

  constructor(subCommands: string[], args: string[]) {
    this.projectPath = subCommands[0] || args.projectPath || '.';
  }

  public async detect(): Promise<{ engine: string; engineVersion: string }> {
    // Todo - detect and return real versions
    return {
      engine: 'unity',
      engineVersion: '2020.1.0f1',
    };
  }
}
