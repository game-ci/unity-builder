import { YargsInstance, YargsArguments } from '../dependencies.ts';

export class AndroidOptions {
  public static configureCommonOptions(yargs: YargsInstance): void {
    yargs
      .option('androidAppBundle', {
        description: 'Build an Android App Bundle',
        type: 'boolean',
        demandOption: false,
        default: false,
      })
      .options({
        androidKeystoreName: {
          description: 'Name of the keystore',
          type: 'string',
          demandOption: false,
          default: '',
        },
        androidKeystoreBase64: {
          description: 'Base64 encoded contents of the keystore',
          type: 'string',
          demandOption: false,
          default: '',
        },
        androidKeystorePass: {
          description: 'Password for the keystore',
          type: 'string',
          demandOption: false,
          default: '',
          deprecated: 'Use androidKeystorePassword instead',
        },
        androidKeystorePassword: {
          description: 'Password for the keystore',
          type: 'string',
          demandOption: false,
          default: '',
        },
        androidKeyAlias: {
          description: 'Alias for the keystore',
          type: 'string',
          demandOption: false,
          default: '',
        },
        androidKeyAliasName: {
          description: 'Name of the keystore',
          type: 'string',
          demandOption: false,
          default: '',
          deprecated: 'Use androidKeyAlias instead',
        },
        androidKeyAliasPassword: {
          description: 'Password for the androidKeyAlias',
          type: 'string',
          demandOption: false,
          default: '',
          requires: ['androidKeyAlias'],
        },
        androidKeyAliasPass: {
          description: 'Password for the androidKeyAlias',
          type: 'string',
          demandOption: false,
          default: '',
          deprecated: 'Use androidKeyAliasPassword instead',
        },
      })
      .option('androidTargetSdkVersion', {
        description: 'Custom Android SDK target version',
        type: 'number',
        demandOption: false,
        default: '',
      })
      .default('androidSdkManagerParameters', '') // Placeholder, consumed in middleware
      .middleware([AndroidOptions.determineSdkManagerParameters]);
  }

  private static determineSdkManagerParameters(argv: YargsArguments) {
    const { androidTargetSdkVersion } = argv;

    if (!androidTargetSdkVersion) return;

    argv.androidSdkManagerParameters = `platforms;android-${androidTargetSdkVersion}`;
  }
}
