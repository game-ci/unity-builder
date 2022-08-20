import { fsSync as fs } from '../../../dependencies.ts';
import { Parameters } from '../../../model/index.ts';

class ValidateWindows {
  public static validate(buildParameters: Parameters) {
    ValidateWindows.validateWindowsPlatformRequirements(buildParameters.targetPlatform);
    if (!(Deno.env.get('UNITY_EMAIL') && Deno.env.get('UNITY_PASSWORD'))) {
      throw new Error(String.dedent`
        Unity email and password must be set for Windows based builds to authenticate the license.

        Make sure to set them inside UNITY_EMAIL and UNITY_PASSWORD in Github Secrets and pass them into the environment.
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
        Windows 10 SDK not found in default location. Make sure this machine has a Windows 10 SDK installed.

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

        Make sure the runner has Visual Studio installed in the default location

        Download here: https://visualstudio.microsoft.com/downloads/
      `);
    }
  }
}

export default ValidateWindows;
