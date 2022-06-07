import { BuildParameters } from './index.ts';
import { SetupMac, SetupWindows } from './platform-setup/index.ts';
import ValidateWindows from './platform-validation/validate-windows.ts';

class PlatformSetup {
  static async setup(buildParameters: BuildParameters, actionFolder: string) {
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
