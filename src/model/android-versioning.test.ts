import AndroidBuildVersionGenerator from '../middleware/build-versioning/android-build-version-generator.ts';

describe('Android Versioning', () => {
  describe('versionToVersionCode', () => {
    it('defaults to 0 when versioning strategy is none', () => {
      expect(AndroidBuildVersionGenerator.versionToVersionCode('none')).toBe(0);
    });

    it('defaults to 1 when version is not a valid semver', () => {
      expect(AndroidBuildVersionGenerator.versionToVersionCode('abcd')).toBe(1);
    });

    it('returns a number', () => {
      expect(AndroidBuildVersionGenerator.versionToVersionCode('123.456.789')).toBe(123_456_789);
    });

    it('throw when generated version code is too large', () => {
      expect(() => AndroidBuildVersionGenerator.versionToVersionCode('2050.0.0')).toThrow();
    });
  });

  describe('determineVersionCode', () => {
    it('defaults to parsed version', () => {
      expect(AndroidBuildVersionGenerator.determineVersionCode('1.2.3', '')).toBe(1_002_003);
    });

    it('use specified code', () => {
      expect(AndroidBuildVersionGenerator.determineVersionCode('1.2.3', 2)).toBe(2);
    });
  });

  describe('determineSdkManagerParameters', () => {
    it('defaults to blank', () => {
      expect(AndroidBuildVersionGenerator.determineSdkManagerParameters('AndroidApiLevelAuto')).toBe('');
    });

    it('uses the specified api level', () => {
      expect(AndroidBuildVersionGenerator.determineSdkManagerParameters('AndroidApiLevel30')).toBe('platforms;android-30');
    });
  });
});
