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
    } = parameters;

    return {
      version: unityVersion,
      platform: targetPlatform,
      projectPath,
      buildName,
      buildPath: `${buildsPath}/${targetPlatform}`,
      buildFile: this.parseBuildFile(buildName, targetPlatform),
      buildMethod,
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
