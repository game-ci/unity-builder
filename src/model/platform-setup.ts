import { Parameters } from './index.ts';
import { SetupMac, SetupWindows } from '../logic/unity/platform-setup/index.ts';
import ValidateWindows from '../logic/unity/platform-validation/validate-windows.ts';

class PlatformSetup {
  static async setup(parameters: Parameters, actionFolder: string) {
    switch (process.platform) {
      case 'win32':
        await SetupWindows.setup(parameters);
        break;
      case 'darwin':
        await SetupMac.setup(parameters, actionFolder);
        break;

      // Add other baseOS's here
    }
  }
}

export default PlatformSetup;
