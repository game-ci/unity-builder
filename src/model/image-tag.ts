import Platform from './platform';

class ImageTag {
  public repository: string;
  public editorVersion: string;
  public targetPlatform: string;
  public builderPlatform: string;
  public customImage: string;
  public imageRollingVersion: number;
  public imagePlatformPrefix: string;

  constructor(imageProperties: { [key: string]: string }) {
    const {
      editorVersion,
      targetPlatform,
      customImage,
      buildPlatform,
      containerRegistryRepository,
      containerRegistryImageVersion,
      providerStrategy,
    } = imageProperties;

    if (!ImageTag.versionPattern.test(editorVersion)) {
      throw new Error(`Invalid version "${editorVersion}".`);
    }

    // Todo we might as well skip this class for customImage.
    // Either
    this.customImage = customImage;

    // Or
    this.repository = containerRegistryRepository;
    this.editorVersion = editorVersion;
    this.targetPlatform = targetPlatform;
    this.builderPlatform = ImageTag.getTargetPlatformToTargetPlatformSuffixMap(
      targetPlatform,
      editorVersion,
      providerStrategy,
    );
    this.imagePlatformPrefix = ImageTag.getImagePlatformPrefixes(buildPlatform);
    this.imageRollingVersion = Number(containerRegistryImageVersion); // Will automatically roll to the latest non-breaking version.
  }

  static get versionPattern(): RegExp {
    return /^\d+\.\d+\.\d+[a-z]\d+$/;
  }

  static get targetPlatformSuffixes() {
    return {
      generic: '',
      webgl: 'webgl',
      mac: 'mac-mono',
      windows: 'windows-mono',
      windowsIl2cpp: 'windows-il2cpp',
      wsaPlayer: 'universal-windows-platform',
      linux: 'base',
      linuxIl2cpp: 'linux-il2cpp',
      android: 'android',
      ios: 'ios',
      tvos: 'appletv',
      facebook: 'facebook',
    };
  }

  static getImagePlatformPrefixes(platform: string): string {
    if (!platform || platform === '') {
      platform = process.platform;
    }

    switch (platform) {
      case 'win32':
        return 'windows';
      case 'linux':
        return 'ubuntu';
      default:
        return '';
    }
  }

  static getTargetPlatformToTargetPlatformSuffixMap(
    platform: string,
    version: string,
    providerStrategy: string,
  ): string {
    const { generic, webgl, mac, windows, windowsIl2cpp, wsaPlayer, linux, linuxIl2cpp, android, ios, tvos, facebook } =
      ImageTag.targetPlatformSuffixes;

    const [major, minor] = version.split('.').map((digit) => Number(digit));

    // @see: https://docs.unity3d.com/ScriptReference/BuildTarget.html
    switch (platform) {
      case Platform.types.StandaloneOSX:
        return mac;
      case Platform.types.StandaloneWindows:
      case Platform.types.StandaloneWindows64:
        // Can only build windows-il2cpp on a windows based system
        if (process.platform === 'win32') {
          // Unity versions before 2019.3 do not support il2cpp
          if (major >= 2020 || (major === 2019 && minor >= 3)) {
            return windowsIl2cpp;
          } else {
            throw new Error(
              `Windows-based builds are only supported on 2019.3.X+ versions of Unity.
                             If you are trying to build for windows-mono, please use a Linux based OS.`,
            );
          }
        }

        return windows;
      case Platform.types.StandaloneLinux64: {
        // Unity versions before 2019.3 do not support il2cpp
        if (major >= 2020 || (major === 2019 && minor >= 3)) {
          if (providerStrategy === 'local') {
            return linuxIl2cpp;
          } else {
            return process.env.USE_IL2CPP === 'true' ? linuxIl2cpp : linux;
          }
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

        return wsaPlayer;
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

  get tag(): string {
    const versionAndPlatform = `${this.editorVersion}-${this.builderPlatform}`.replace(/-+$/, '');

    return `${this.imagePlatformPrefix}-${versionAndPlatform}-${this.imageRollingVersion}`;
  }

  get image(): string {
    return `${this.repository}`.replace(/^\/+/, '');
  }

  toString(): string {
    const { image, tag, customImage } = this;

    if (customImage) return customImage;

    return `${image}:${tag}`;
  }
}

export default ImageTag;
