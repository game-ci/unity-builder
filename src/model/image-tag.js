import { has, get, trimEnd, trimStart } from 'lodash-es';
import Platform from './platform';

class ImageTag {
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

    if (!has(ImageTag.targetPlatformToImageSuffixMap, platform)) {
      throw new Error(`Platform "${platform}" is currently not supported.`);
    }

    const builderPlatform = get(
      ImageTag.targetPlatformToImageSuffixMap,
      platform,
      ImageTag.imageSuffixes.generic,
    );

    Object.assign(this, { repository, name, version, platform, builderPlatform });
  }

  static get versionPattern() {
    return /^20\d{2}\.\d\.\w{3,4}|3$/;
  }

  static get imageSuffixes() {
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

  static get targetPlatformToImageSuffixMap() {
    const { generic, webgl, mac, windows, android, ios, facebook } = ImageTag.imageSuffixes;

    // @see: https://docs.unity3d.com/ScriptReference/BuildTarget.html
    return {
      [Platform.types.StandaloneOSX]: mac,
      [Platform.types.StandaloneWindows]: windows,
      [Platform.types.StandaloneWindows64]: windows,
      [Platform.types.StandaloneLinux64]: windows,
      [Platform.types.iOS]: ios,
      [Platform.types.Android]: android,
      [Platform.types.WebGL]: webgl,
      [Platform.types.WSAPlayer]: windows,
      [Platform.types.PS4]: windows,
      [Platform.types.XboxOne]: windows,
      [Platform.types.tvOS]: windows,
      [Platform.types.Switch]: windows,
      // Unsupported
      [Platform.types.Lumin]: windows,
      [Platform.types.BJM]: windows,
      [Platform.types.Stadia]: windows,
      [Platform.types.Facebook]: facebook,
      [Platform.types.NoTarget]: generic,
      // Test specific
      [Platform.types.Test]: generic,
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

export default ImageTag;
