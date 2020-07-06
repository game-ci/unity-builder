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

    it('returns the android version code with provided input', async () => {
      const mockValue = '42';
      jest.spyOn(Input, 'androidVersionCode', 'get').mockReturnValue(mockValue);
      await expect(BuildParameters.create()).resolves.toEqual(
        expect.objectContaining({ androidVersionCode: mockValue }),
      );
    });

    it('returns the android version code from version by default', async () => {
      const mockValue = '';
      jest.spyOn(Input, 'androidVersionCode', 'get').mockReturnValue(mockValue);
      await expect(BuildParameters.create()).resolves.toEqual(
        expect.objectContaining({ androidVersionCode: 1003037 }),
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
      jest.spyOn(Input, 'androidAppBundle', 'get').mockReturnValue(false);
      await expect(BuildParameters.create()).resolves.toEqual(
        expect.objectContaining({ buildFile: `${targetPlatform}.apk` }),
      );
    });

    test.each([Platform.types.Android])('appends aab for %s', async (targetPlatform) => {
      jest.spyOn(Input, 'targetPlatform', 'get').mockReturnValue(targetPlatform);
      jest.spyOn(Input, 'buildName', 'get').mockReturnValue(targetPlatform);
      jest.spyOn(Input, 'androidAppBundle', 'get').mockReturnValue(true);
      await expect(BuildParameters.create()).resolves.toEqual(
        expect.objectContaining({ buildFile: `${targetPlatform}.aab` }),
      );
    });

    it('returns the build method', async () => {
      const mockValue = 'Namespace.ClassName.BuildMethod';
      jest.spyOn(Input, 'buildMethod', 'get').mockReturnValue(mockValue);
      await expect(BuildParameters.create()).resolves.toEqual(
        expect.objectContaining({ buildMethod: mockValue }),
      );
    });

    it('returns the android keystore name', async () => {
      const mockValue = 'keystore.keystore';
      jest.spyOn(Input, 'androidKeystoreName', 'get').mockReturnValue(mockValue);
      await expect(BuildParameters.create()).resolves.toEqual(
        expect.objectContaining({ androidKeystoreName: mockValue }),
      );
    });

    it('returns the android keystore base64-encoded content', async () => {
      const mockValue = 'secret';
      jest.spyOn(Input, 'androidKeystoreBase64', 'get').mockReturnValue(mockValue);
      await expect(BuildParameters.create()).resolves.toEqual(
        expect.objectContaining({ androidKeystoreBase64: mockValue }),
      );
    });

    it('returns the android keystore pass', async () => {
      const mockValue = 'secret';
      jest.spyOn(Input, 'androidKeystorePass', 'get').mockReturnValue(mockValue);
      await expect(BuildParameters.create()).resolves.toEqual(
        expect.objectContaining({ androidKeystorePass: mockValue }),
      );
    });

    it('returns the android keyalias name', async () => {
      const mockValue = 'secret';
      jest.spyOn(Input, 'androidKeyaliasName', 'get').mockReturnValue(mockValue);
      await expect(BuildParameters.create()).resolves.toEqual(
        expect.objectContaining({ androidKeyaliasName: mockValue }),
      );
    });

    it('returns the android keyalias pass', async () => {
      const mockValue = 'secret';
      jest.spyOn(Input, 'androidKeyaliasPass', 'get').mockReturnValue(mockValue);
      await expect(BuildParameters.create()).resolves.toEqual(
        expect.objectContaining({ androidKeyaliasPass: mockValue }),
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
