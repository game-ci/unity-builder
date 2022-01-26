/* eslint no-console: "off" */
import { BuildParameters } from '..';
import { getUnityChangeset } from 'unity-changeset';
import fs from 'fs';

class SetupMac {
  //static unityHubPath = `/Applications/Unity\\\\ Hub.app/Contents/MacOS/Unity\\\\ Hub`;

  public static async setup(buildParameters: BuildParameters, actionFolder: string) {
    const unityChangeset = await getUnityChangeset(buildParameters.version);

    const environmentContent = `SCRIPT_DIRECTORY=${actionFolder}/platforms/mac/
    UNITY_VERSION=${buildParameters.version}
    UNITY_CHANGESET=${unityChangeset.changeset}
    UNITY_SERIAL=${buildParameters.unitySerial}
    PROJECT_PATH=${buildParameters.projectPath}
    BUILD_TARGET=${buildParameters.platform}
    BUILD_NAME=${buildParameters.buildName}
    BUILD_PATH=${buildParameters.buildPath}
    BUILD_FILE=${buildParameters.buildFile}
    BUILD_METHOD=${buildParameters.buildMethod}
    VERSION=${buildParameters.buildVersion}
    ANDROID_VERSION_CODE=${buildParameters.androidVersionCode}
    ANDROID_KEYSTORE_NAME=${buildParameters.androidKeystoreName}
    ANDROID_KEYSTORE_BASE64=${buildParameters.androidKeystoreBase64}
    ANDROID_KEYSTORE_PASS=${buildParameters.androidKeystorePass}
    ANDROID_KEYALIAS_NAME=${buildParameters.androidKeyaliasName}
    ANDROID_KEYALIAS_PASS=${buildParameters.androidKeyaliasPass}
    ANDROID_TARGET_SDK_VERSION=${buildParameters.androidTargetSdkVersion}
    ANDROID_SDK_MANAGER_PARAMETERS=${buildParameters.androidSdkManagerParameters}
    CUSTOM_PARAMETERS=${buildParameters.customParameters}
    CHOWN_FILES_TO=${buildParameters.chownFilesTo}`;
    //Since we are using shell scripts on the host, we need to set the environment variables from here
    try {
      console.log(`${process.env.RUNNER_TEMP}/build.env`);
      fs.writeFileSync(`${process.env.RUNNER_TEMP}/build.env`, environmentContent);
      console.log('Wrote file');
      console.log(fs.readFileSync(`${process.env.RUNNER_TEMP}/build.env`));
    } catch (error) {
      console.log(error);
    }
  }
}

export default SetupMac;
