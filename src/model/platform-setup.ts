import { BuildParameters } from '.';
import SetupWindows from './platform-setup/setup-windows';
import ValidateWindows from './platform-validation/validate-windows';

class PlatformSetup {
  static async setup(buildParameters: BuildParameters) {
    switch (process.platform) {
      case 'win32':
        ValidateWindows.validate(buildParameters);
        SetupWindows.setup(buildParameters);
        break;
      //Add other baseOS's here
    }
  }
}

export default PlatformSetup;
