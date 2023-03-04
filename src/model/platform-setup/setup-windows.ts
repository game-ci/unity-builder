import { exec } from '@actions/exec';
import fs from 'node:fs';
import { BuildParameters } from '..';

class SetupWindows {
  public static async setup(buildParameters: BuildParameters) {
    const { targetPlatform } = buildParameters;

    await SetupWindows.setupWindowsRun(targetPlatform);
  }

  private static async setupWindowsRun(targetPlatform: string, silent: boolean = false) {
    if (!fs.existsSync('c:/regkeys')) {
      fs.mkdirSync('c:/regkeys');
    }

    // These all need the Windows 10 SDK
    switch (targetPlatform) {
      case 'StandaloneWindows':
      case 'StandaloneWindows64':
      case 'WSAPlayer':
        await this.generateWinSDKRegKeys(silent);
        break;
    }
  }

  private static async generateWinSDKRegKeys(silent: boolean = false) {
    // Export registry keys that point to the Windows 10 SDK
    const exportWinSDKRegKeysCommand =
      'reg export "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Microsoft SDKs\\Windows\\v10.0" c:/regkeys/winsdk.reg /y';
    await exec(exportWinSDKRegKeysCommand, undefined, { silent });
  }
}

export default SetupWindows;
