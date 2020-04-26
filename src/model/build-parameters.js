import Platform from './platform';

class BuildParameters {
  static create(parameters) {
    const {
      version,
      targetPlatform,
      projectPath,
      buildName,
      buildsPath,
      buildMethod,
      buildVersion,
      customParameters,
    } = parameters;

    return {
      version,
      platform: targetPlatform,
      projectPath,
      buildName,
      buildPath: `${buildsPath}/${targetPlatform}`,
      buildFile: this.parseBuildFile(buildName, targetPlatform),
      buildMethod,
      buildVersion,
      customParameters,
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
