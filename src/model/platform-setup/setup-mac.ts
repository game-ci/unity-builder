import { BuildParameters } from '../index.ts';
import { fsSync as fs, exec, getUnityChangeset } from '../../dependencies.ts';

class SetupMac {
  static unityHubPath = `"/Applications/Unity Hub.app/Contents/MacOS/Unity Hub"`;

  public static async setup(buildParameters: BuildParameters, actionFolder: string) {
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
      // Ignoring return code because the log seems to overflow the internal buffer which triggers
      // a false error
      const errorCode = await exec(command, undefined, { silent, ignoreReturnCode: true });
      if (errorCode) {
        throw new Error(`There was an error installing the Unity Editor. See logs above for details.`);
      }
    }
  }

  private static async installUnity(buildParameters: BuildParameters, silent = false) {
    const unityChangeset = await getUnityChangeset(buildParameters.editorVersion);
    const command = `${this.unityHubPath} -- --headless install \
                                          --version ${buildParameters.editorVersion} \
                                          --changeset ${unityChangeset.changeset} \
                                          --module mac-il2cpp \
                                          --childModules`;

    // Ignoring return code because the log seems to overflow the internal buffer which triggers
    // a false error
    const errorCode = await exec(command, undefined, { silent, ignoreReturnCode: true });
    if (errorCode) {
      throw new Error(`There was an error installing the Unity Editor. See logs above for details.`);
    }
  }

  private static async setEnvironmentVariables(buildParameters: BuildParameters, actionFolder: string) {
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
