import { UnityTargetPlatform } from '../index.ts';

export class UnityTargetPlatforms {
  public static readonly all = [
    UnityTargetPlatform.Android,
    UnityTargetPlatform.iOS,
    UnityTargetPlatform.StandaloneLinux64,
    UnityTargetPlatform.StandaloneOSX,
    UnityTargetPlatform.StandaloneWindows,
    UnityTargetPlatform.StandaloneWindows64,
    UnityTargetPlatform.Switch,
    UnityTargetPlatform.tvOS,
    UnityTargetPlatform.WebGL,
    UnityTargetPlatform.WSAPlayer,
    UnityTargetPlatform.XboxOne,

    // Unsupported
    UnityTargetPlatform.Lumin,
    UnityTargetPlatform.BJM,
    UnityTargetPlatform.Stadia,
    UnityTargetPlatform.Facebook,
    UnityTargetPlatform.NoTarget,

    // Test specific
    UnityTargetPlatform.Test,
  ];
}
