import { Parameters } from './index.ts';
import { SetupMac, SetupWindows } from '../logic/unity/platform-setup/index.ts';
import ValidateWindows from '../logic/unity/platform-validation/validate-windows.ts';

class PlatformSetup {
  static async setup(buildParameters: Parameters, actionFolder: string) {
    switch (process.platform) {
      case 'win32':
        ValidateWindows.validate(buildParameters);
        SetupWindows.setup(buildParameters);
        break;
      case 'darwin':
        await SetupMac.setup(buildParameters, actionFolder);
        break;

      // Add other baseOS's here
    }
  }
}

export default PlatformSetup;
