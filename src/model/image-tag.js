import { has, get, trimEnd, trimStart } from 'lodash-es';

export default class ImageTag {
  constructor(imageProperties) {
    const {
      repository = 'gableroux',
      name = 'unity3d',
      version = '2019.2.11f1',
      platform,
    } = imageProperties;

    if (!ImageTag.versionPattern.test(version)) {
      throw new Error(`Invalid version "${version}".`);
    }

    if (!has(ImageTag.targetPlatformToBuilderPlatformMap, platform)) {
      throw new Error(`Platform "${platform}" is currently not supported.`);
    }

    const builderPlatform = get(
      ImageTag.targetPlatformToBuilderPlatformMap,
      platform,
      ImageTag.builderPlatforms.generic,
    );

    Object.assign(this, { repository, name, version, platform, builderPlatform });
  }

  static get versionPattern() {
    return /^20\d{2}\.\d\.\w{3,4}|3$/;
  }

  static get builderPlatforms() {
    return {
      generic: '',
      webgl: 'webgl',
      mac: 'mac',
      windows: 'windows',
      android: 'android',
      ios: 'ios',
      facebook: 'facebook',
    };
  }

  static get targetPlatformToBuilderPlatformMap() {
    const { generic, webgl, mac, windows, android, ios, facebook } = ImageTag.builderPlatforms;

    // @see: https://docs.unity3d.com/ScriptReference/BuildTarget.html
    return {
      StandaloneOSX: mac,
      StandaloneWindows: windows,
      StandaloneWindows64: windows,
      StandaloneLinux64: windows,
      iOS: ios,
      Android: android,
      WebGL: webgl,
      WSAPlayer: windows,
      PS4: windows,
      XboxOne: windows,
      tvOS: windows,
      Switch: windows,
      // Unsupported
      Lumin: windows,
      BJM: windows,
      Stadia: windows,
      Facebook: facebook,
      NoTarget: generic,
      // Test specific
      Test: generic,
    };
  }

  get tag() {
    return trimEnd(`${this.version}-${this.builderPlatform}`, '-');
  }

  get image() {
    return trimStart(`${this.repository}/${this.name}`, '/');
  }

  toString() {
    const { image, tag } = this;

    return `${image}:${tag}`;
  }
}
