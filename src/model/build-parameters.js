import AndroidVersioning from './android-versioning';
import Input from './input';
import Platform from './platform';
import Versioning from './versioning';

class BuildParameters {
  static async create() {
    const buildFile = this.parseBuildFile(
      Input.buildName,
      Input.targetPlatform,
      Input.androidAppBundle,
    );
    const buildVersion = await Versioning.determineVersion(
      Input.versioningStrategy,
      Input.specifiedVersion,
    );

    const androidVersionCode = AndroidVersioning.determineVersionCode(
      buildVersion,
      Input.androidVersionCode,
    );

    return {
      version: Input.unityVersion,
      platform: Input.targetPlatform,
      projectPath: Input.projectPath,
      buildName: Input.buildName,
      buildPath: `${Input.buildsPath}/${Input.targetPlatform}`,
      buildFile,
      buildMethod: Input.buildMethod,
      buildVersion,
      androidVersionCode,
      androidKeystoreName: Input.androidKeystoreName,
      androidKeystoreBase64: Input.androidKeystoreBase64,
      androidKeystorePass: Input.androidKeystorePass,
      androidKeyaliasName: Input.androidKeyaliasName,
      androidKeyaliasPass: Input.androidKeyaliasPass,
      customParameters: Input.customParameters,
    };
  }

  static parseBuildFile(filename, platform, androidAppBundle) {
    if (Platform.isWindows(platform)) {
      return `${filename}.exe`;
    }

    if (Platform.isAndroid(platform)) {
      return androidAppBundle ? `${filename}.aab` : `${filename}.apk`;
    }

    return filename;
  }
}

export default BuildParameters;
