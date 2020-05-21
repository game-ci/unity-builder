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

    return {
      version: Input.unityVersion,
      platform: Input.targetPlatform,
      projectPath: Input.projectPath,
      buildName: Input.buildName,
      buildPath: `${Input.buildsPath}/${Input.targetPlatform}`,
      buildFile,
      buildMethod: Input.buildMethod,
      buildVersion,
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
