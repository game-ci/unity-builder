import { YargsInstance } from '../dependencies.ts';
import Unity from '../model/unity/unity.ts';

export class BuildOptions {
  public static configure(yargs: YargsInstance): void {
    yargs
      .demandOption('targetPlatform', 'Target platform is mandatory for builds')
      .option('buildName', {
        description: 'Name of the build',
        type: 'string',
        default: '',
      })
      .option('buildsPath', {
        description: 'Path for outputting the builds to',
        type: 'string',
        demandOption: false,
        default: 'build',
      })
      .default('buildPath', '')
      .default('buildFile', '')
      .middleware(async (argv) => {
        const { buildName, buildsPath, targetPlatform, androidAppBundle } = argv;
        argv.buildName = buildName || targetPlatform;
        argv.buildPath = `${buildsPath}/${targetPlatform}`;
        argv.buildFile = Unity.determineBuildFileName(buildName, targetPlatform, androidAppBundle);
      });
  }
}
