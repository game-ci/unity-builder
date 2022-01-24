import { exec } from '@actions/exec';
import fs from 'fs';
import { BuildParameters } from '..';

class SetupWindows {
  public static async setup(buildParameters: BuildParameters) {
    await SetupWindows.setupWindowsRun(buildParameters.platform);
  }

  //Setup prerequisite files/folders for a windows-based docker run
  private static async setupWindowsRun(platform, silent = false) {
    if (!fs.existsSync('c:/regkeys')) {
      fs.mkdirSync('c:/regkeys');
    }
    switch (platform) {
      //These all need the Windows 10 SDK
      case 'StandaloneWindows':
      case 'StandaloneWindows64':
      case 'WSAPlayer':
        this.generateWinSDKRegKeys(silent);
        break;
    }
  }

  private static async generateWinSDKRegKeys(silent = false) {
    // Export registry keys that point to the location of the windows 10 sdk
    const exportWinSDKRegKeysCommand =
      'reg export "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Microsoft SDKs\\Windows\\v10.0" c:/regkeys/winsdk.reg /y';
    await exec(exportWinSDKRegKeysCommand, undefined, { silent });
  }
}

export default SetupWindows;
