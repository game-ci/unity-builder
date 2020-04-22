import Platform from './platform';

class BuildParameters {
  static create(parameters) {
    const {
      unityVersion,
      targetPlatform,
      projectPath,
      buildName,
      buildsPath,
      buildMethod,
      versioning,
      version,
      customParameters,
    } = parameters;

    return {
      unityVersion,
      platform: targetPlatform,
      projectPath,
      buildName,
      buildPath: `${buildsPath}/${targetPlatform}`,
      buildFile: this.parseBuildFile(buildName, targetPlatform),
      buildMethod,
      versioning,
      version,
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
