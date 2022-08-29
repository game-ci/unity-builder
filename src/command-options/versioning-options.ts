import { YargsInstance } from '../dependencies.ts';
import { VersioningStrategies } from '../model/versioning/versioning-strategies.ts';
import { VersioningStrategy } from '../model/versioning/versioning-strategy.ts';
import { buildVersioning } from '../middleware/build-versioning/index.ts';

export class VersioningOptions {
  public static async configure(yargs: YargsInstance): void {
    yargs
      .option('versioningStrategy', {
        description: 'Versioning strategy',
        choices: VersioningStrategies.all,
        demandOption: true,
        default: VersioningStrategy.Semantic,
      })
      .option('version', {
        description: String.dedent`
          Custom version to use for the build.
          Only used when versioningStrategy is set to Custom`,
        type: 'string',
        default: '',
      })
      .option('androidVersionCode', {
        description: String.dedent`
          Custom version code for android specifically.`,
        type: 'string',
        default: '',
      })
      .option('allowDirtyBuild', {
        description: 'Allow a dirty build',
        type: 'boolean',
        demandOption: false,
        default: false,
      })
      .default('buildVersion', 'placeholder')
      .middleware([buildVersioning]);
  }
}
