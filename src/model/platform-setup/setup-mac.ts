import { BuildParameters } from '..';
import { getUnityChangeset } from 'unity-changeset';

class SetupMac {
  //static unityHubPath = `/Applications/Unity\\\\ Hub.app/Contents/MacOS/Unity\\\\ Hub`;

  public static async setup(buildParameters: BuildParameters, actionFolder: string) {
    const changeset = await getUnityChangeset(buildParameters.version).changeset;
    //Since we are using shell scripts on the host, we need to set the environment variables from here
    process.env.SCRIPT_DIRECTORY = `${actionFolder}/platforms/mac/`;
    process.env.UNITY_VERSION = buildParameters.version;
    process.env.UNITY_CHANGESET = changeset;
    process.env.UNITY_SERIAL = buildParameters.unitySerial;
    process.env.PROJECT_PATH = buildParameters.projectPath;
    process.env.BUILD_TARGET = buildParameters.platform;
    process.env.BUILD_NAME = buildParameters.buildName;
    process.env.BUILD_PATH = buildParameters.buildPath;
    process.env.BUILD_FILE = buildParameters.buildFile;
    process.env.BUILD_METHOD = buildParameters.buildMethod;
    process.env.VERSION = buildParameters.buildVersion;
    process.env.ANDROID_VERSION_CODE = buildParameters.androidVersionCode;
    process.env.ANDROID_KEYSTORE_NAME = buildParameters.androidKeystoreName;
    process.env.ANDROID_KEYSTORE_BASE64 = buildParameters.androidKeystoreBase64;
    process.env.ANDROID_KEYSTORE_PASS = buildParameters.androidKeystorePass;
    process.env.ANDROID_KEYALIAS_NAME = buildParameters.androidKeyaliasName;
    process.env.ANDROID_KEYALIAS_PASS = buildParameters.androidKeyaliasPass;
    process.env.ANDROID_TARGET_SDK_VERSION = buildParameters.androidTargetSdkVersion;
    process.env.ANDROID_SDK_MANAGER_PARAMETERS = buildParameters.androidSdkManagerParameters;
    process.env.CUSTOM_PARAMETERS = buildParameters.customParameters;
    process.env.CHOWN_FILES_TO = buildParameters.chownFilesTo;
    // const unityEditorPath = `/Applications/Unity/Hub/Editor/${buildParameters.version}/Unity.app/Contents/MacOS/Unity`;
    // if (!fs.existsSync(unityEditorPath)) {
    //   await SetupMac.installUnityHub();
    //   await SetupMac.installUnity(buildParameters);
    // }
  }

  // private static async installUnityHub(silent = false) {
  //   const command = 'brew install unity-hub';
  //   if (!fs.existsSync(this.unityHubPath)) {
  //     await exec(command, undefined, { silent });
  //   }
  // }

  // private static async installUnity(buildParameters: BuildParameters, silent = false) {

  //   const command = `${this.unityHubPath} -- --headless install
  //                                         --version ${buildParameters.version}
  //                                         --changeset ${changeset}
  //                                         --module mac-il2cpp
  //                                         --childModules`;
  //   await exec(command, undefined, { silent });
  // }
}

export default SetupMac;
