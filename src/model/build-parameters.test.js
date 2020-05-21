import Versioning from './versioning';
import BuildParameters from './build-parameters';
import Input from './input';
import Platform from './platform';

const determineVersion = jest
  .spyOn(Versioning, 'determineVersion')
  .mockImplementation(() => '1.3.37');

afterEach(() => {
  jest.clearAllMocks();
});

describe('BuildParameters', () => {
  describe('create', () => {
    it('does not throw', async () => {
      await expect(BuildParameters.create()).resolves.not.toThrow();
    });

    it('determines the version only once', async () => {
      await BuildParameters.create();
      expect(determineVersion).toHaveBeenCalledTimes(1);
    });

    it('returns the version', async () => {
      const mockValue = 'someVersion';
      jest.spyOn(Input, 'unityVersion', 'get').mockReturnValue(mockValue);
      await expect(BuildParameters.create()).resolves.toEqual(
        expect.objectContaining({ version: mockValue }),
      );
    });

    it('returns the platform', async () => {
      const mockValue = 'somePlatform';
      jest.spyOn(Input, 'targetPlatform', 'get').mockReturnValue(mockValue);
      await expect(BuildParameters.create()).resolves.toEqual(
        expect.objectContaining({ platform: mockValue }),
      );
    });

    it('returns the project path', async () => {
      const mockValue = 'path/to/project';
      jest.spyOn(Input, 'projectPath', 'get').mockReturnValue(mockValue);
      await expect(BuildParameters.create()).resolves.toEqual(
        expect.objectContaining({ projectPath: mockValue }),
      );
    });

    it('returns the build name', async () => {
      const mockValue = 'someBuildName';
      jest.spyOn(Input, 'buildName', 'get').mockReturnValue(mockValue);
      await expect(BuildParameters.create()).resolves.toEqual(
        expect.objectContaining({ buildName: mockValue }),
      );
    });

    it('returns the build path', async () => {
      const mockPath = 'somePath';
      const mockPlatform = 'somePlatform';
      const expectedBuildPath = `${mockPath}/${mockPlatform}`;
      jest.spyOn(Input, 'buildsPath', 'get').mockReturnValue(mockPath);
      jest.spyOn(Input, 'targetPlatform', 'get').mockReturnValue(mockPlatform);
      await expect(BuildParameters.create()).resolves.toEqual(
        expect.objectContaining({ buildPath: expectedBuildPath }),
      );
    });

    it('returns the build file', async () => {
      const mockValue = 'someBuildName';
      jest.spyOn(Input, 'buildName', 'get').mockReturnValue(mockValue);
      await expect(BuildParameters.create()).resolves.toEqual(
        expect.objectContaining({ buildFile: mockValue }),
      );
    });

    test.each([Platform.types.StandaloneWindows, Platform.types.StandaloneWindows64])(
      'appends exe for %s',
      async (targetPlatform) => {
        jest.spyOn(Input, 'targetPlatform', 'get').mockReturnValue(targetPlatform);
        jest.spyOn(Input, 'buildName', 'get').mockReturnValue(targetPlatform);
        await expect(BuildParameters.create()).resolves.toEqual(
          expect.objectContaining({ buildFile: `${targetPlatform}.exe` }),
        );
      },
    );

    test.each([Platform.types.Android])('appends apk for %s', async (targetPlatform) => {
      jest.spyOn(Input, 'targetPlatform', 'get').mockReturnValue(targetPlatform);
      jest.spyOn(Input, 'buildName', 'get').mockReturnValue(targetPlatform);
      await expect(BuildParameters.create()).resolves.toEqual(
        expect.objectContaining({ buildFile: `${targetPlatform}.apk` }),
      );
    });

    it('returns the build method', async () => {
      const mockValue = 'Namespace.ClassName.BuildMethod';
      jest.spyOn(Input, 'buildMethod', 'get').mockReturnValue(mockValue);
      await expect(BuildParameters.create()).resolves.toEqual(
        expect.objectContaining({ buildMethod: mockValue }),
      );
    });

    it('returns the custom parameters', async () => {
      const mockValue = '-profile SomeProfile -someBoolean -someValue exampleValue';
      jest.spyOn(Input, 'customParameters', 'get').mockReturnValue(mockValue);
      await expect(BuildParameters.create()).resolves.toEqual(
        expect.objectContaining({ customParameters: mockValue }),
      );
    });
  });
});
