import { EngineDetector } from './engine-detector.ts';

export const engineDetection = async (argv) => {
  const { projectPath } = argv;

  if (!projectPath) throw new Error('Unable to detect engine. No project path provided.');

  const { engine, engineVersion } = await new EngineDetector(projectPath).detect();

  argv.engine = engine;
  argv.engineVersion = engineVersion;
};
