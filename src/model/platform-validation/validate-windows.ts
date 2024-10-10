import fs from 'node:fs';
import { BuildParameters } from '..';

class ValidateWindows {
  public static validate(buildParameters: BuildParameters) {
    ValidateWindows.validateWindowsPlatformRequirements(buildParameters.targetPlatform);

    const { unityLicensingServer } = buildParameters;
    const hasLicensingCredentials = process.env.UNITY_EMAIL && process.env.UNITY_PASSWORD;
    const hasValidLicensingStrategy = hasLicensingCredentials || unityLicensingServer;

    if (!hasValidLicensingStrategy) {
      throw new Error(`Unity email and password or alternatively a Unity licensing server url must be set for 
                       Windows based builds to authenticate the license. Make sure to set them inside UNITY_EMAIL
                       and UNITY_PASSWORD in Github Secrets and pass them into the environment.`);
    }
  }

  private static validateWindowsPlatformRequirements(platform: string) {
    switch (platform) {
      case 'StandaloneWindows':
      case 'StandaloneWindows64':
      case 'WSAPlayer':
        this.checkForVisualStudio();
        this.checkForWin10SDK();
        break;
      case 'tvOS':
        this.checkForVisualStudio();
        break;
    }
  }

  private static checkForWin10SDK() {
    // Check for Windows 10 SDK on runner
    const windows10SDKPathExists = fs.existsSync('C:/Program Files (x86)/Windows Kits');
    if (!windows10SDKPathExists) {
      throw new Error(`Windows 10 SDK not found in default location. Make sure
                      the runner has a Windows 10 SDK installed in the default
                      location.`);
    }
  }

  private static checkForVisualStudio() {
    // Note: When upgrading to Server 2022, we will need to move to just "program files" since VS will be 64-bit
    const visualStudioInstallPathExists = fs.existsSync('C:/Program Files (x86)/Microsoft Visual Studio');
    const visualStudioDataPathExists = fs.existsSync('C:/ProgramData/Microsoft/VisualStudio');

    if (!visualStudioInstallPathExists || !visualStudioDataPathExists) {
      throw new Error(`Visual Studio not found at the default location.
              Make sure the runner has Visual Studio installed in the
              default location`);
    }
  }
}

export default ValidateWindows;
