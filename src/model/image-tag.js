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
    return /^20\d{2}\.\d\.\w{4}|3$/;
  }

  static get builderPlatforms() {
    return {
      generic: '',
      webgl: 'webgl',
      mac: 'mac',
      windows: 'windows',
      android: 'android',
      ios: 'ios',
    };
  }

  static get targetPlatformToBuilderPlatformMap() {
    const { generic, webgl, mac, windows, android, ios } = ImageTag.builderPlatforms;

    // @see: https://github.com/Unity-Technologies/UnityCsReference/blob/9034442437e6b5efe28c51d02e978a96a3ce5439/Editor/Mono/BuildTarget.cs
    return {
      Test: generic,
      WebGL: webgl,
      StandaloneOSX: mac,
      StandaloneWindows: windows,
      StandaloneWindows64: windows,
      StandaloneLinux64: generic,
      PS4: generic,
      XboxOne: generic,
      Switch: generic,
      Android: android,
      iOS: ios,
      tvOS: generic,
      Lumin: generic,
      BJM: generic,
      Stadia: generic,
      WSAPlayer: generic,
      Facebook: generic,
      // *undocumented*
      NoTarget: generic,
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
