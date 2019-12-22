import { has, get, trimEnd } from 'lodash-es';

export default class Image {
  constructor(imageProperties) {
    const {
      repository = 'gableroux',
      name = 'unity3d',
      version = '2019.2.11f1',
      targetPlatform,
    } = imageProperties;

    if (!Image.versionPattern.test(version)) {
      throw new Error(`Invalid version "${version}".`);
    }

    if (!has(Image.targetPlatformToBuilderPlatformMap, targetPlatform)) {
      throw new Error(`Platform "${targetPlatform}" is currently not supported.`);
    }

    const builderPlatform = get(
      Image.targetPlatformToBuilderPlatformMap,
      targetPlatform,
      Image.builderPlatforms.generic,
    );

    Object.assign(this, { repository, name, version, targetPlatform, builderPlatform });
  }

  static get versionPattern() {
    return /^20\d{2}\.\d\.\w{4}$/;
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
    const { generic, webgl, mac, windows, android, ios } = Image.builderPlatforms;

    return {
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
    };
  }

  get tag() {
    return trimEnd(`${this.version}-${this.builderPlatform}`, '-');
  }

  toString() {
    const { repository, name, tag } = this;

    return `${repository}/${name}:${tag}`;
  }
}
