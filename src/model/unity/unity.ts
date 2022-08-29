import UnityTargetPlatform from './unity-target-platform.ts';

class Unity {
  static get libraryFolder() {
    return 'Library';
  }

  static determineBuildFileName(buildName, platform, androidAppBundle) {
    if (UnityTargetPlatform.isWindows(platform)) {
      return `${buildName}.exe`;
    }

    if (UnityTargetPlatform.isAndroid(platform)) {
      return androidAppBundle ? `${buildName}.aab` : `${buildName}.apk`;
    }

    return buildName;
  }
}

export default Unity;
