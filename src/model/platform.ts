class Platform {
  static get default() {
    return Platform.types.StandaloneWindows64;
  }

  static get types() {
    return {
      StandaloneOSX: 'StandaloneOSX',
      StandaloneWindows: 'StandaloneWindows',
      StandaloneWindows64: 'StandaloneWindows64',
      StandaloneLinux64: 'StandaloneLinux64',
      iOS: 'iOS',
      Android: 'Android',
      WebGL: 'WebGL',
      WSAPlayer: 'WSAPlayer',
      PS4: 'PS4',
      XboxOne: 'XboxOne',
      tvOS: 'tvOS',
      Switch: 'Switch',

      // Unsupported
      Lumin: 'Lumin',
      BJM: 'BJM',
      Stadia: 'Stadia',
      Facebook: 'Facebook',
      NoTarget: 'NoTarget',

      // Test specific
      Test: 'Test',
    };
  }

  static isWindows(platform: string) {
    switch (platform) {
      case Platform.types.StandaloneWindows:
      case Platform.types.StandaloneWindows64:
        return true;
      default:
        return false;
    }
  }

  static isAndroid(platform: string) {
    switch (platform) {
      case Platform.types.Android:
        return true;
      default:
        return false;
    }
  }
}

export default Platform;
