import { BuildParameters } from '..';
import { getUnityChangeset } from 'unity-changeset';

class SetupMac {
  public static async setup(buildParameters: BuildParameters, actionFolder: string) {
    const unityChangeset = await getUnityChangeset(buildParameters.version);

    //Need to set environment variables from here because we execute
    //the scripts on the host for mac
    process.env.ACTION_FOLDER = actionFolder;
    process.env.UNITY_VERSION = buildParameters.version;
    process.env.UNITY_CHANGESET = unityChangeset.changeset;
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
  }
}

export default SetupMac;
