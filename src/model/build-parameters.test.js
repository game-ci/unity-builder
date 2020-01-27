import BuildParameters from './build-parameters';
import Platform from './platform';

describe('BuildParameters', () => {
  describe('create', () => {
    const someParameters = {
      unityVersion: 'someVersion',
      targetPlatform: 'somePlatform',
      projectPath: 'path/to/project',
      buildName: 'someBuildName',
      buildsPath: 'someBuildsPath',
      buildMethod: 'Namespace.Class.Method',
      customParameters: '-someParam someValue',
    };

    it('does not throw', () => {
      expect(() => BuildParameters.create(someParameters)).not.toThrow();
    });

    it('returns the version', () => {
      expect(BuildParameters.create(someParameters).version).toStrictEqual(
        someParameters.unityVersion,
      );
    });

    it('returns the platform', () => {
      expect(BuildParameters.create(someParameters).platform).toStrictEqual(
        someParameters.targetPlatform,
      );
    });

    it('returns the project path', () => {
      expect(BuildParameters.create(someParameters).projectPath).toStrictEqual(
        someParameters.projectPath,
      );
    });

    it('returns the build name', () => {
      expect(BuildParameters.create(someParameters).buildName).toStrictEqual(
        someParameters.buildName,
      );
    });

    it('returns the build path', () => {
      expect(BuildParameters.create(someParameters).buildPath).toStrictEqual(
        `${someParameters.buildsPath}/${someParameters.targetPlatform}`,
      );
    });

    describe('build file', () => {
      it('returns the build file', () => {
        expect(BuildParameters.create(someParameters).buildFile).toStrictEqual(
          someParameters.buildName,
        );
      });

      test.each([Platform.types.StandaloneWindows, Platform.types.StandaloneWindows64])(
        'appends exe for %s',
        targetPlatform => {
          expect(
            BuildParameters.create({ ...someParameters, targetPlatform }).buildFile,
          ).toStrictEqual(`${someParameters.buildName}.exe`);
        },
      );

      test.each([Platform.types.Android])('appends apk for %s', targetPlatform => {
        expect(
          BuildParameters.create({ ...someParameters, targetPlatform }).buildFile,
        ).toStrictEqual(`${someParameters.buildName}.apk`);
      });
    });

    it('returns the build method', () => {
      expect(BuildParameters.create(someParameters).buildMethod).toStrictEqual(
        someParameters.buildMethod,
      );
    });

    it('returns the custom parameters', () => {
      expect(BuildParameters.create(someParameters).customParameters).toStrictEqual(
        someParameters.customParameters,
      );
    });
  });
});
