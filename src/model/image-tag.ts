import Platform from './platform';

class ImageTag {
  public repository: string;
  public name: string;
  public version: string;
  public platform: any;
  public builderPlatform: string;
  public customImage: any;

  constructor(imageProperties) {
    const { repository = 'unityci', name = 'editor', version = '2019.2.11f1', platform, customImage } = imageProperties;

    if (!ImageTag.versionPattern.test(version)) {
      throw new Error(`Invalid version "${version}".`);
    }

    const builderPlatform = ImageTag.getTargetPlatformToImageSuffixMap(platform, version);

    this.repository = repository;
    this.name = name;
    this.version = version;
    this.platform = platform;
    this.builderPlatform = builderPlatform;
    this.customImage = customImage;
  }

  static get versionPattern() {
    return /^20\d{2}\.\d\.\w{3,4}|3$/;
  }

  static get imageSuffixes() {
    return {
      generic: '',
      webgl: 'webgl',
      mac: 'mac-mono',
      windows: 'windows-mono',
      linux: 'base',
      linuxIl2cpp: 'linux-il2cpp',
      android: 'android',
      ios: 'ios',
      facebook: 'facebook',
    };
  }

  static getTargetPlatformToImageSuffixMap(platform, version) {
    const { generic, webgl, mac, windows, linux, linuxIl2cpp, android, ios, facebook } = ImageTag.imageSuffixes;

    const [major, minor] = version.split('.').map((digit) => Number(digit));
    // @see: https://docs.unity3d.com/ScriptReference/BuildTarget.html
    switch (platform) {
      case Platform.types.StandaloneOSX:
        return mac;
      case Platform.types.StandaloneWindows:
        return windows;
      case Platform.types.StandaloneWindows64:
        return windows;
      case Platform.types.StandaloneLinux64: {
        // Unity versions before 2019.3 do not support il2cpp
        if (major >= 2020 || (major === 2019 && minor >= 3)) {
          return linuxIl2cpp;
        }
        return linux;
      }
      case Platform.types.iOS:
        return ios;
      case Platform.types.Android:
        return android;
      case Platform.types.WebGL:
        return webgl;
      case Platform.types.WSAPlayer:
        return windows;
      case Platform.types.PS4:
        return windows;
      case Platform.types.XboxOne:
        return windows;
      case Platform.types.tvOS:
        return windows;
      case Platform.types.Switch:
        return windows;
      // Unsupported
      case Platform.types.Lumin:
        return windows;
      case Platform.types.BJM:
        return windows;
      case Platform.types.Stadia:
        return windows;
      case Platform.types.Facebook:
        return facebook;
      case Platform.types.NoTarget:
        return generic;

      // Test specific
      case Platform.types.Test:
        return generic;
      default:
        throw new Error(`
          Platform must be one of the ones described in the documentation.
          "${platform}" is currently not supported.`);
    }
  }

  get tag() {
    return `${this.version}-${this.builderPlatform}`.replace(/-+$/, '');
  }

  get image() {
    return `${this.repository}/${this.name}`.replace(/^\/+/, '');
  }

  toString() {
    const { image, tag, customImage } = this;

    if (customImage && customImage !== '') {
      return customImage;
    }

    return `${image}:${tag}-0`; // '0' here represents the docker repo version
  }
}

export default ImageTag;
