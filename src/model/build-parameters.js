import AndroidVersioning from './android-versioning';
import Input from './input';
import Platform from './platform';
import Versioning from './versioning';

class BuildParameters {
  static async create() {
    const buildFile = this.parseBuildFile(Input.buildName, Input.targetPlatform);
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
      customParameters: Input.customParameters,
    };
  }

  static parseBuildFile(filename, platform) {
    if (Platform.isWindows(platform)) {
      return `${filename}.exe`;
    }

    if (Platform.isAndroid(platform)) {
      return `${filename}.apk`;
    }

    return filename;
  }
}

export default BuildParameters;
