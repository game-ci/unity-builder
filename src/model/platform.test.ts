import Platform from './platform';

describe('Platform', () => {
  describe('default', () => {
    it('does not throw', () => {
      expect(() => Platform.default).not.toThrow();
    });

    it('returns a string', () => {
      expect(typeof Platform.default).toStrictEqual('string');
    });

    it('returns a platform', () => {
      expect(Object.values(Platform.types)).toContain(Platform.default);
    });
  });

  describe('isWindows', () => {
    it('returns true for windows', () => {
      expect(Platform.isWindows(Platform.types.StandaloneWindows64)).toStrictEqual(true);
    });

    it('returns false for MacOS', () => {
      expect(Platform.isWindows(Platform.types.StandaloneOSX)).toStrictEqual(false);
    });
  });

  describe('isAndroid', () => {
    it('returns true for Android', () => {
      expect(Platform.isAndroid(Platform.types.Android)).toStrictEqual(true);
    });

    it('returns false for Windows', () => {
      expect(Platform.isAndroid(Platform.types.StandaloneWindows64)).toStrictEqual(false);
    });
  });
});
