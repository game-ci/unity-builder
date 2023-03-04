import AndroidVersioning from './android-versioning';

describe('Android Versioning', () => {
  describe('versionToVersionCode', () => {
    it('defaults to 0 when versioning strategy is none', () => {
      expect(AndroidVersioning.versionToVersionCode('none')).toBe('0');
    });

    it('defaults to 1 when version is not a valid semver', () => {
      expect(AndroidVersioning.versionToVersionCode('abcd')).toBe('1');
    });

    it('returns a number', () => {
      expect(AndroidVersioning.versionToVersionCode('123.456.789')).toBe('123456789');
    });

    it('throw when generated version code is too large', () => {
      expect(() => AndroidVersioning.versionToVersionCode('2050.0.0')).toThrow();
    });
  });

  describe('determineVersionCode', () => {
    it('defaults to parsed version', () => {
      expect(AndroidVersioning.determineVersionCode('1.2.3', '')).toBe('1002003');
    });

    it('use specified code', () => {
      expect(AndroidVersioning.determineVersionCode('1.2.3', '2')).toBe('2');
    });
  });

  describe('determineSdkManagerParameters', () => {
    it('defaults to blank', () => {
      expect(AndroidVersioning.determineSdkManagerParameters('AndroidApiLevelAuto')).toBe('');
    });

    it('uses the specified api level', () => {
      expect(AndroidVersioning.determineSdkManagerParameters('AndroidApiLevel30')).toBe('platforms;android-30');
    });
  });
});
