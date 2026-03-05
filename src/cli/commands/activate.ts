import type { CommandModule } from 'yargs';
import * as core from '@actions/core';
import { mapCliArgumentsToInput, CliArguments } from '../input-mapper';

interface ActivateArguments extends CliArguments {
  unityVersion?: string;
  unitySerial?: string;
  unityLicensingServer?: string;
}

const activateCommand: CommandModule<object, ActivateArguments> = {
  command: 'activate',
  describe: 'Verify Unity license configuration',
  builder: (yargs) => {
    return yargs
      .option('unity-version', {
        alias: 'unityVersion',
        type: 'string',
        description: 'Version of Unity to activate',
        default: 'auto',
      })
      .option('unity-licensing-server', {
        alias: 'unityLicensingServer',
        type: 'string',
        description: 'The Unity licensing server address for floating licenses',
        default: '',
      })
      .env('UNITY')
      .example(
        'UNITY_SERIAL=XXXX-XXXX-XXXX-XXXX game-ci activate',
        'Activate Unity using a serial from environment variable',
      )
      .example(
        'game-ci activate --unity-licensing-server http://license-server:8080',
        'Activate Unity using a floating license server',
      ) as any;
  },
  handler: async (cliArguments) => {
    try {
      mapCliArgumentsToInput(cliArguments);

      const unitySerial = process.env.UNITY_SERIAL;
      const unityLicense = process.env.UNITY_LICENSE;
      const licensingServer = cliArguments.unityLicensingServer || process.env.UNITY_LICENSING_SERVER || '';

      if (licensingServer) {
        core.info(`Activating Unity via licensing server: ${licensingServer}`);
        core.info('Floating license activation is handled automatically during builds.');
        core.info('No manual activation step is needed when using a licensing server.');

        return;
      }

      if (!unitySerial && !unityLicense) {
        throw new Error(
          'No Unity license found.\n\n' +
            'Provide one of the following:\n' +
            '  - UNITY_SERIAL environment variable (professional license)\n' +
            '  - UNITY_LICENSE environment variable (personal license file content)\n' +
            '  - --unity-licensing-server flag (floating license)\n\n' +
            'For more information, visit: https://game.ci/docs/github/activation',
        );
      }

      if (unitySerial) {
        const maskedSerial = unitySerial.length > 8 ? `${unitySerial.slice(0, 4)}...${unitySerial.slice(-4)}` : '****';
        core.info(`Unity serial detected: ${maskedSerial}`);
        core.info('License will be activated automatically when running a build.');
      } else if (unityLicense) {
        core.info('Unity license file detected from UNITY_LICENSE environment variable.');
        core.info('License will be activated automatically when running a build.');
      }

      core.info('\nActivation verified. You can now run: game-ci build --target-platform <platform>');
    } catch (error: any) {
      core.setFailed(`Activation failed: ${error.message}`);

      throw error;
    }
  },
};

export default activateCommand;
