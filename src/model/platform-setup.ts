import fs from 'node:fs';
import * as core from '@actions/core';
import { BuildParameters } from '.';
import { SetupMac, SetupWindows, SetupAndroid } from './platform-setup/';
import ValidateWindows from './platform-validation/validate-windows';

class PlatformSetup {
  static async setup(buildParameters: BuildParameters, actionFolder: string) {
    PlatformSetup.SetupShared(buildParameters, actionFolder);

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

  private static SetupShared(buildParameters: BuildParameters, actionFolder: string) {
    const servicesConfigPath = `${actionFolder}/unity-config/services-config.json`;
    const servicesConfigPathTemplate = `${servicesConfigPath}.template`;
    if (!fs.existsSync(servicesConfigPathTemplate)) {
      core.error(`Missing services config ${servicesConfigPathTemplate}`);

      return;
    }

    let servicesConfig = fs.readFileSync(servicesConfigPathTemplate).toString();
    servicesConfig = servicesConfig.replace('%URL%', buildParameters.unityLicensingServer);
    fs.writeFileSync(servicesConfigPath, servicesConfig);

    SetupAndroid.setup(buildParameters);
  }
}

export default PlatformSetup;
