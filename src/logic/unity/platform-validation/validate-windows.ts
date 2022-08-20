import { fsSync as fs } from '../../../dependencies.ts';
import { Parameters } from '../../../model/index.ts';

class ValidateWindows {
  public static validate(parameters: Parameters) {
    ValidateWindows.validateWindowsPlatformRequirements(parameters.targetPlatform);
    if (!parameters.unityEmail || !parameters.unityPassword) {
      throw new Error(String.dedent`
        Unity email and password must be set for Windows based builds to authenticate the license.

        Please make sure to set the unityEmail (UNITY_EMAIL) and unityPassword (UNITY_PASSWORD) parameters.
      `);
    }
  }

  private static validateWindowsPlatformRequirements(platform) {
    switch (platform) {
      case 'StandaloneWindows':
        this.checkForVisualStudio();
        this.checkForWin10SDK();
        break;
      case 'StandaloneWindows64':
        this.checkForVisualStudio();
        this.checkForWin10SDK();
        break;
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
      throw new Error(String.dedent`
        Windows 10 SDK not found in default location. Please make sure this machine has a Windows 10 SDK installed.

        Download here: https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/
      `);
    }
  }

  private static checkForVisualStudio() {
    // Note: When upgrading to Server 2022, we will need to move to just "program files" since VS will be 64-bit
    const visualStudioInstallPathExists = fs.existsSync('C:/Program Files (x86)/Microsoft Visual Studio');
    const visualStudioDataPathExists = fs.existsSync('C:/ProgramData/Microsoft/VisualStudio');

    if (!visualStudioInstallPathExists || !visualStudioDataPathExists) {
      throw new Error(String.dedent`
        Visual Studio not found at the default location.

        Please make sure the runner has Visual Studio installed in the default location

        Download here: https://visualstudio.microsoft.com/downloads/
      `);
    }
  }
}

export default ValidateWindows;
