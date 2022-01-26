import { BuildParameters } from '.';
import { SetupWindows, SetupMac } from './platform-setup/';
import ValidateWindows from './platform-validation/validate-windows';

class PlatformSetup {
  static async setup(buildParameters: BuildParameters, actionFolder: string) {
    switch (process.platform) {
      case 'win32':
        ValidateWindows.validate(buildParameters);
        SetupWindows.setup(buildParameters);
        break;
      case 'darwin':
        SetupMac.setup(buildParameters, actionFolder);
        break;
      //Add other baseOS's here
    }
  }
}

export default PlatformSetup;
