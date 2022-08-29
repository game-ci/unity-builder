import UnityVersionDetector from './unity-version-detector.ts';

export class EngineDetector {
  private readonly projectPath: string;

  constructor(projectPath) {
    this.projectPath = projectPath;
  }

  public async detect(): Promise<{ engine: string; engineVersion: string }> {
    if (UnityVersionDetector.isUnityProject(this.projectPath)) {
      const engineVersion = await UnityVersionDetector.getUnityVersion(this.projectPath);

      return { engine: 'unity', engineVersion };
    }

    return {
      engine: 'unknown',
      engineVersion: 'unknown',
    };
  }
}
