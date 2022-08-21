import { fsSync as fs } from '../../../dependencies.ts';
import { Parameters } from '../../../model/index.ts';
import ValidateWindows from '../platform-validation/validate-windows.ts';
import System from '../../../model/system.ts';

class SetupWindows {
  public static async setup(parameters: Parameters) {
    ValidateWindows.validate(parameters);
    await this.generateWinSdkRegistryKey(parameters);
  }

  private static async generateWinSdkRegistryKey(parameters) {
    const { targetPlatform, cliStoragePath } = parameters;

    if (!['StandaloneWindows', 'StandaloneWindows64', 'WSAPlayer'].includes(targetPlatform)) return;

    const registryKeysPath = `${cliStoragePath}/registry-keys`;
    const copyWinSdkRegistryKeyCommand = `reg export "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Microsoft SDKs\\Windows\\v10.0" ${registryKeysPath}/winsdk.reg /y`;

    await fs.ensureDir(registryKeysPath);
    await System.run(copyWinSdkRegistryKeyCommand);
  }
}

export default SetupWindows;
