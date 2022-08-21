import { Parameters } from '../../../model/index.ts';
import { fsSync as fs, getUnityChangeSet } from '../../../dependencies.ts';
import System from '../../../model/system.ts';

class SetupMac {
  static unityHubPath = `"/Applications/Unity Hub.app/Contents/MacOS/Unity Hub"`;

  public static async setup(buildParameters: Parameters, actionFolder: string) {
    const unityEditorPath = `/Applications/Unity/Hub/Editor/${buildParameters.editorVersion}/Unity.app/Contents/MacOS/Unity`;

    // Only install unity if the editor doesn't already exist
    if (!fs.existsSync(unityEditorPath)) {
      await SetupMac.installUnityHub();
      await SetupMac.installUnity(buildParameters);
    }

    await SetupMac.setEnvironmentVariables(buildParameters, actionFolder);
  }

  private static async installUnityHub(silent = false) {
    const command = 'brew install unity-hub';
    if (!fs.existsSync(this.unityHubPath)) {
      try {
        await System.run(command, { silent, ignoreReturnCode: true });
      } catch (error) {
        throw new Error(`There was an error installing the Unity Editor. See logs above for details. ${error}`);
      }
    }
  }

  private static async installUnity(buildParameters: Parameters, silent = false) {
    const unityChangeSet = await getUnityChangeSet(buildParameters.editorVersion);
    const command = `${this.unityHubPath} -- --headless install \
                                          --version ${buildParameters.editorVersion} \
                                          --changeset ${unityChangeSet.changeset} \
                                          --module mac-il2cpp \
                                          --childModules`;

    try {
      await System.run(command, { silent, ignoreReturnCode: true });
    } catch (error) {
      throw new Error(`There was an error installing the Unity Editor. See logs above for details. ${error}`);
    }
  }

  private static async setEnvironmentVariables(buildParameters: Parameters, actionFolder: string) {
    // Need to set environment variables from here because we execute
    // the scripts on the host for mac
    Deno.env.set('ACTION_FOLDER', actionFolder);
    Deno.env.set('UNITY_VERSION', buildParameters.editorVersion);
    Deno.env.set('UNITY_SERIAL', buildParameters.unitySerial);
    Deno.env.set('PROJECT_PATH', buildParameters.projectPath);
    Deno.env.set('BUILD_TARGET', buildParameters.targetPlatform);
    Deno.env.set('BUILD_NAME', buildParameters.buildName);
    Deno.env.set('BUILD_PATH', buildParameters.buildPath);
    Deno.env.set('BUILD_FILE', buildParameters.buildFile);
    Deno.env.set('BUILD_METHOD', buildParameters.buildMethod);
    Deno.env.set('VERSION', buildParameters.buildVersion);
    Deno.env.set('ANDROID_VERSION_CODE', buildParameters.androidVersionCode);
    Deno.env.set('ANDROID_KEYSTORE_NAME', buildParameters.androidKeystoreName);
    Deno.env.set('ANDROID_KEYSTORE_BASE64', buildParameters.androidKeystoreBase64);
    Deno.env.set('ANDROID_KEYSTORE_PASS', buildParameters.androidKeystorePass);
    Deno.env.set('ANDROID_KEYALIAS_NAME', buildParameters.androidKeyaliasName);
    Deno.env.set('ANDROID_KEYALIAS_PASS', buildParameters.androidKeyaliasPass);
    Deno.env.set('ANDROID_TARGET_SDK_VERSION', buildParameters.androidTargetSdkVersion);
    Deno.env.set('ANDROID_SDK_MANAGER_PARAMETERS', buildParameters.androidSdkManagerParameters);
    Deno.env.set('CUSTOM_PARAMETERS', buildParameters.customParameters);
    Deno.env.set('CHOWN_FILES_TO', buildParameters.chownFilesTo);
  }
}

export default SetupMac;
