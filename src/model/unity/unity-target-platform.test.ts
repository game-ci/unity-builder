import UnityTargetPlatform from './unity-target-platform.ts';

describe('UnityTargetPlatform', () => {
  describe('default', () => {
    it('does not throw', () => {
      expect(() => UnityTargetPlatform.default).not.toThrow();
    });

    it('returns a string', () => {
      expect(typeof UnityTargetPlatform.default).toStrictEqual('string');
    });

    it('returns a platform', () => {
      expect(Object.values(UnityTargetPlatform.types)).toContain(UnityTargetPlatform.default);
    });
  });

  describe('isWindows', () => {
    it('returns true for windows', () => {
      expect(UnityTargetPlatform.isWindows(UnityTargetPlatform.StandaloneWindows64)).toStrictEqual(true);
    });

    it('returns false for MacOS', () => {
      expect(UnityTargetPlatform.isWindows(UnityTargetPlatform.StandaloneOSX)).toStrictEqual(false);
    });
  });

  describe('isAndroid', () => {
    it('returns true for Android', () => {
      expect(UnityTargetPlatform.isAndroid(UnityTargetPlatform.Android)).toStrictEqual(true);
    });

    it('returns false for Windows', () => {
      expect(UnityTargetPlatform.isAndroid(UnityTargetPlatform.StandaloneWindows64)).toStrictEqual(false);
    });
  });
});
