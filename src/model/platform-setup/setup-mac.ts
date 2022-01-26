import { exec } from '@actions/exec';
import fs from 'fs';
import { BuildParameters } from '..';
import { getUnityChangeset } from 'unity-changeset';

class SetupMac {
  static unityHubPath = '/Applications/Unity\\ Hub.app/Contents/MacOS/Unity\\ Hub';

  public static async setup(buildParameters: BuildParameters) {
    const unityEditorPath = `/Applications/Unity/Hub/Editor/${buildParameters.version}/Unity.app/Contents/MacOS/Unity`;
    if (!fs.existsSync(unityEditorPath)) {
      await SetupMac.installUnityHub();
      await SetupMac.installUnity(buildParameters);
    }
  }

  private static async installUnityHub(silent = false) {
    const command = 'brew install unity-hub';
    if (!fs.existsSync(this.unityHubPath)) {
      await exec(command, undefined, { silent });
    }
  }

  private static async installUnity(buildParameters: BuildParameters, silent = false) {
    const changeset = await getUnityChangeset(buildParameters.version).changeset;
    const command = `${this.unityHubPath} -- --headless install
                                          --version ${buildParameters.version}
                                          --changeset ${changeset}
                                          --module mac-il2cpp
                                          --childModules`;
    await exec(command, undefined, { silent });
  }
}

export default SetupMac;
