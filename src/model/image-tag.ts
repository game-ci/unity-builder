import UnityTargetPlatform from './unity/unity-target-platform.ts';

import Parameters from './parameters.ts';

class ImageTag {
  public repository: string;
  public name: string;
  public cloudRunnerBuilderPlatform!: string | undefined;
  public editorVersion: string;
  public targetPlatform: any;
  public builderPlatform: string;
  public customImage: any;
  public imageRollingVersion: number;
  public imagePlatformPrefix: string;

  constructor(imageProperties: Partial<Parameters>) {
    const { editorVersion = '2019.2.11f1', targetPlatform, customImage, cloudRunnerBuilderPlatform } = imageProperties;

    if (!ImageTag.versionPattern.test(editorVersion)) {
      throw new Error(`Invalid version "${editorVersion}".`);
    }

    // Todo we might as well skip this class for customImage.
    // Either
    this.customImage = customImage;

    // Or
    this.repository = 'unityci';
    this.name = 'editor';
    this.editorVersion = editorVersion;
    this.targetPlatform = targetPlatform;
    this.cloudRunnerBuilderPlatform = cloudRunnerBuilderPlatform;
    const isCloudRunnerLocal = cloudRunnerBuilderPlatform === 'local' || cloudRunnerBuilderPlatform === undefined;
    this.builderPlatform = ImageTag.getTargetPlatformToTargetPlatformSuffixMap(targetPlatform, editorVersion);
    this.imagePlatformPrefix = ImageTag.getImagePlatformPrefixes(
      isCloudRunnerLocal ? process.platform : cloudRunnerBuilderPlatform,
    );
    this.imageRollingVersion = 1; // Will automatically roll to the latest non-breaking version.
  }

  static get versionPattern() {
    return /^20\d{2}\.\d\.\w{3,4}|3$/;
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

  static getImagePlatformPrefixes(platform) {
    switch (platform) {
      case 'win32':
        return 'windows';
      case 'linux':
        return 'ubuntu';
      default:
        return '';
    }
  }

  static getTargetPlatformToTargetPlatformSuffixMap(platform, version) {
    const { generic, webgl, mac, windows, windowsIl2cpp, wsaPlayer, linux, linuxIl2cpp, android, ios, tvos, facebook } =
      ImageTag.targetPlatformSuffixes;

    const [major, minor] = version.split('.').map(Number);

    // @see: https://docs.unity3d.com/ScriptReference/BuildTarget.html
    switch (platform) {
      case UnityTargetPlatform.StandaloneOSX:
        return mac;
      case UnityTargetPlatform.StandaloneWindows:
      case UnityTargetPlatform.StandaloneWindows64:
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
      case UnityTargetPlatform.StandaloneLinux64: {
        // Unity versions before 2019.3 do not support il2cpp
        if (major >= 2020 || (major === 2019 && minor >= 3)) {
          return linuxIl2cpp;
        }

        return linux;
      }
      case UnityTargetPlatform.iOS:
        return ios;
      case UnityTargetPlatform.Android:
        return android;
      case UnityTargetPlatform.WebGL:
        return webgl;
      case UnityTargetPlatform.WSAPlayer:
        if (process.platform !== 'win32') {
          throw new Error(`WSAPlayer can only be built on a windows base OS`);
        }

        return wsaPlayer;
      case UnityTargetPlatform.PS4:
        return windows;
      case UnityTargetPlatform.XboxOne:
        return windows;
      case UnityTargetPlatform.tvOS:
        if (process.platform !== 'win32') {
          throw new Error(`tvOS can only be built on a windows base OS`);
        }

        return tvos;
      case UnityTargetPlatform.Switch:
        return windows;

      // Unsupported
      case UnityTargetPlatform.Lumin:
        return windows;
      case UnityTargetPlatform.BJM:
        return windows;
      case UnityTargetPlatform.Stadia:
        return windows;
      case UnityTargetPlatform.Facebook:
        return facebook;
      case UnityTargetPlatform.NoTarget:
        return generic;

      // Test specific
      case UnityTargetPlatform.Test:
        return generic;
      default:
        throw new Error(`
          Platform must be one of the ones described in the documentation.
          "${platform}" is currently not supported.`);
    }
  }

  get tag() {
    const versionAndPlatform = `${this.editorVersion}-${this.builderPlatform}`.replace(/-+$/, '');

    return `${this.imagePlatformPrefix}-${versionAndPlatform}-${this.imageRollingVersion}`;
  }

  get image() {
    return `${this.repository}/${this.name}`.replace(/^\/+/, '');
  }

  toString() {
    const { image, tag, customImage } = this;

    if (customImage) return customImage;

    return `${image}:${tag}`; // '0' here represents the docker repo version
  }
}
export default ImageTag;
