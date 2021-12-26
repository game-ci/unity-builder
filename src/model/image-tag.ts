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
      windowsIl2cpp: 'windows-il2cpp',
      wsaplayer: 'universal-windows-platform',
      linux: 'base',
      linuxIl2cpp: 'linux-il2cpp',
      android: 'android',
      ios: 'ios',
      tvos: 'appletv',
      facebook: 'facebook',
    };
  }

  static getTargetPlatformToImageSuffixMap(platform, version) {
    const {
      generic,
      webgl,
      mac,
      windows,
      windowsIl2cpp,
      wsaplayer,
      linux,
      linuxIl2cpp,
      android,
      ios,
      tvos,
      facebook,
    } = ImageTag.imageSuffixes;

    const [major, minor] = version.split('.').map((digit) => Number(digit));
    // @see: https://docs.unity3d.com/ScriptReference/BuildTarget.html
    switch (platform) {
      case Platform.types.StandaloneOSX:
        return mac;
      case Platform.types.StandaloneWindows:
        // Can only build windows-il2cpp on a windows based system
        if (process.platform === 'win32') {
          // Unity versions before 2019.3 do not support il2cpp
          if (major >= 2020 || (major === 2019 && minor >= 3)) {
            return windowsIl2cpp;
          } else {
            throw new Error(`Windows-based builds are only supported on 2019.3.X+ versions of Unity.
                             If you are trying to build for windows-mono, please use a Linux based OS.`);
          }
        }
        return windows;
      case Platform.types.StandaloneWindows64:
        // Can only build windows-il2cpp on a windows based system
        if (process.platform === 'win32') {
          // Unity versions before 2019.3 do not support il2cpp
          if (major >= 2020 || (major === 2019 && minor >= 3)) {
            return windowsIl2cpp;
          } else {
            throw new Error(`Windows-based builds are only supported on 2019.3.X+ versions of Unity.
                             If you are trying to build for windows-mono, please use a Linux based OS.`);
          }
        }
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
        if (process.platform !== 'win32') {
          throw new Error(`WSAPlayer can only be built on a windows base OS`);
        }
        return wsaplayer;
      case Platform.types.PS4:
        return windows;
      case Platform.types.XboxOne:
        return windows;
      case Platform.types.tvOS:
        if (process.platform !== 'win32') {
          throw new Error(`tvOS can only be built on a windows base OS`);
        }
        return tvos;
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
    //We check the host os so we know what type of the images we need to pull
    switch (process.platform) {
      case 'win32':
        return `windows-${this.version}-${this.builderPlatform}`.replace(/-+$/, '');
      case 'linux':
        return `${this.version}-${this.builderPlatform}`.replace(/-+$/, '');
      default:
        break;
    }
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
