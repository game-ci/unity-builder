import Versioning from './versioning.ts';
import UnityVersioning from './unity-versioning.ts';
import AndroidVersioning from './android-versioning.ts';
import BuildParameters from './build-parameters.ts';
import Input from './input.ts';
import Platform from './platform.ts';

// Todo - Don't use process.env directly, that's what the input model class is for.
const testLicense =
  '<?xml version="1.0" encoding="UTF-8"?><root>\n    <License id="Terms">\n        <MachineBindings>\n            <Binding Key="1" Value="576562626572264761624c65526f7578"/>\n            <Binding Key="2" Value="576562626572264761624c65526f7578"/>\n        </MachineBindings>\n        <MachineID Value="D7nTUnjNAmtsUMcnoyrqkgIbYdM="/>\n        <SerialHash Value="2033b8ac3e6faa3742ca9f0bfae44d18f2a96b80"/>\n        <Features>\n            <Feature Value="33"/>\n            <Feature Value="1"/>\n            <Feature Value="12"/>\n            <Feature Value="2"/>\n            <Feature Value="24"/>\n            <Feature Value="3"/>\n            <Feature Value="36"/>\n            <Feature Value="17"/>\n            <Feature Value="19"/>\n            <Feature Value="62"/>\n        </Features>\n        <DeveloperData Value="AQAAAEY0LUJHUlgtWEQ0RS1aQ1dWLUM1SlctR0RIQg=="/>\n        <SerialMasked Value="F4-BGRX-XD4E-ZCWV-C5JW-XXXX"/>\n        <StartDate Value="2021-02-08T00:00:00"/>\n        <UpdateDate Value="2021-02-09T00:34:57"/>\n        <InitialActivationDate Value="2021-02-08T00:34:56"/>\n        <LicenseVersion Value="6.x"/>\n        <ClientProvidedVersion Value="2018.4.30f1"/>\n        <AlwaysOnline Value="false"/>\n        <Entitlements>\n            <Entitlement Ns="unity_editor" Tag="UnityPersonal" Type="EDITOR" ValidTo="9999-12-31T00:00:00"/>\n            <Entitlement Ns="unity_editor" Tag="DarkSkin" Type="EDITOR_FEATURE" ValidTo="9999-12-31T00:00:00"/>\n        </Entitlements>\n    </License>\n<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315#WithComments"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI="#Terms"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>m0Db8UK+ktnOLJBtHybkfetpcKo=</DigestValue></Reference></SignedInfo><SignatureValue>o/pUbSQAukz7+ZYAWhnA0AJbIlyyCPL7bKVEM2lVqbrXt7cyey+umkCXamuOgsWPVUKBMkXtMH8L\n5etLmD0getWIhTGhzOnDCk+gtIPfL4jMo9tkEuOCROQAXCci23VFscKcrkB+3X6h4wEOtA2APhOY\nB+wvC794o8/82ffjP79aVAi57rp3Wmzx+9pe9yMwoJuljAy2sc2tIMgdQGWVmOGBpQm3JqsidyzI\nJWG2kjnc7pDXK9pwYzXoKiqUqqrut90d+kQqRyv7MSZXR50HFqD/LI69h68b7P8Bjo3bPXOhNXGR\n9YCoemH6EkfCJxp2gIjzjWW+l2Hj2EsFQi8YXw==</SignatureValue></Signature></root>';
process.env.UNITY_LICENSE = testLicense;

const determineVersion = jest.spyOn(Versioning, 'determineBuildVersion').mockImplementation(async () => '1.3.37');
const determineUnityVersion = jest
  .spyOn(UnityVersioning, 'determineUnityVersion')
  .mockImplementation(() => '2019.2.11f1');
const determineSdkManagerParameters = jest
  .spyOn(AndroidVersioning, 'determineSdkManagerParameters')
  .mockImplementation(() => 'platforms;android-30');

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

    it('determines the unity version only once', async () => {
      await BuildParameters.create();
      expect(determineUnityVersion).toHaveBeenCalledTimes(1);
    });

    it('returns the android version code with provided input', async () => {
      const mockValue = '42';
      jest.spyOn(Input, 'androidVersionCode', 'get').mockReturnValue(mockValue);
      expect(BuildParameters.create()).resolves.toEqual(expect.objectContaining({ androidVersionCode: mockValue }));
    });

    it('returns the android version code from version by default', async () => {
      const mockValue = '';
      jest.spyOn(Input, 'androidVersionCode', 'get').mockReturnValue(mockValue);
      expect(BuildParameters.create()).resolves.toEqual(expect.objectContaining({ androidVersionCode: 1003037 }));
    });

    it('determines the android sdk manager parameters only once', async () => {
      await BuildParameters.create();
      expect(determineSdkManagerParameters).toHaveBeenCalledTimes(1);
    });

    it('returns the targetPlatform', async () => {
      const mockValue = 'somePlatform';
      jest.spyOn(Input, 'targetPlatform', 'get').mockReturnValue(mockValue);
      expect(BuildParameters.create()).resolves.toEqual(expect.objectContaining({ targetPlatform: mockValue }));
    });

    it('returns the project path', async () => {
      const mockValue = 'path/to/project';
      jest.spyOn(Input, 'projectPath', 'get').mockReturnValue(mockValue);
      expect(BuildParameters.create()).resolves.toEqual(expect.objectContaining({ projectPath: mockValue }));
    });

    it('returns the build name', async () => {
      const mockValue = 'someBuildName';
      jest.spyOn(Input, 'buildName', 'get').mockReturnValue(mockValue);
      expect(BuildParameters.create()).resolves.toEqual(expect.objectContaining({ buildName: mockValue }));
    });

    it('returns the build path', async () => {
      const mockPath = 'somePath';
      const mockPlatform = 'somePlatform';
      const expectedBuildPath = `${mockPath}/${mockPlatform}`;
      jest.spyOn(Input, 'buildsPath', 'get').mockReturnValue(mockPath);
      jest.spyOn(Input, 'targetPlatform', 'get').mockReturnValue(mockPlatform);
      expect(BuildParameters.create()).resolves.toEqual(expect.objectContaining({ buildPath: expectedBuildPath }));
    });

    it('returns the build file', async () => {
      const mockValue = 'someBuildName';
      jest.spyOn(Input, 'buildName', 'get').mockReturnValue(mockValue);
      expect(BuildParameters.create()).resolves.toEqual(expect.objectContaining({ buildFile: mockValue }));
    });

    test.each([Platform.types.StandaloneWindows, Platform.types.StandaloneWindows64])(
      'appends exe for %s',
      async (targetPlatform) => {
        jest.spyOn(Input, 'targetPlatform', 'get').mockReturnValue(targetPlatform);
        jest.spyOn(Input, 'buildName', 'get').mockReturnValue(targetPlatform);
        expect(BuildParameters.create()).resolves.toEqual(
          expect.objectContaining({ buildFile: `${targetPlatform}.exe` }),
        );
      },
    );

    test.each([Platform.types.Android])('appends apk for %s', async (targetPlatform) => {
      jest.spyOn(Input, 'targetPlatform', 'get').mockReturnValue(targetPlatform);
      jest.spyOn(Input, 'buildName', 'get').mockReturnValue(targetPlatform);
      jest.spyOn(Input, 'androidAppBundle', 'get').mockReturnValue(false);
      expect(BuildParameters.create()).resolves.toEqual(
        expect.objectContaining({ buildFile: `${targetPlatform}.apk` }),
      );
    });

    test.each([Platform.types.Android])('appends aab for %s', async (targetPlatform) => {
      jest.spyOn(Input, 'targetPlatform', 'get').mockReturnValue(targetPlatform);
      jest.spyOn(Input, 'buildName', 'get').mockReturnValue(targetPlatform);
      jest.spyOn(Input, 'androidAppBundle', 'get').mockReturnValue(true);
      expect(BuildParameters.create()).resolves.toEqual(
        expect.objectContaining({ buildFile: `${targetPlatform}.aab` }),
      );
    });

    it('returns the build method', async () => {
      const mockValue = 'Namespace.ClassName.BuildMethod';
      jest.spyOn(Input, 'buildMethod', 'get').mockReturnValue(mockValue);
      expect(BuildParameters.create()).resolves.toEqual(expect.objectContaining({ buildMethod: mockValue }));
    });

    it('returns the android keystore name', async () => {
      const mockValue = 'keystore.keystore';
      jest.spyOn(Input, 'androidKeystoreName', 'get').mockReturnValue(mockValue);
      expect(BuildParameters.create()).resolves.toEqual(expect.objectContaining({ androidKeystoreName: mockValue }));
    });

    it('returns the android keystore base64-encoded content', async () => {
      const mockValue = 'secret';
      jest.spyOn(Input, 'androidKeystoreBase64', 'get').mockReturnValue(mockValue);
      expect(BuildParameters.create()).resolves.toEqual(expect.objectContaining({ androidKeystoreBase64: mockValue }));
    });

    it('returns the android keystore pass', async () => {
      const mockValue = 'secret';
      jest.spyOn(Input, 'androidKeystorePass', 'get').mockReturnValue(mockValue);
      expect(BuildParameters.create()).resolves.toEqual(expect.objectContaining({ androidKeystorePass: mockValue }));
    });

    it('returns the android keyalias name', async () => {
      const mockValue = 'secret';
      jest.spyOn(Input, 'androidKeyaliasName', 'get').mockReturnValue(mockValue);
      expect(BuildParameters.create()).resolves.toEqual(expect.objectContaining({ androidKeyaliasName: mockValue }));
    });

    it('returns the android keyalias pass', async () => {
      const mockValue = 'secret';
      jest.spyOn(Input, 'androidKeyaliasPass', 'get').mockReturnValue(mockValue);
      expect(BuildParameters.create()).resolves.toEqual(expect.objectContaining({ androidKeyaliasPass: mockValue }));
    });

    it('returns the android target sdk version', async () => {
      const mockValue = 'AndroidApiLevelAuto';
      jest.spyOn(Input, 'androidTargetSdkVersion', 'get').mockReturnValue(mockValue);
      expect(BuildParameters.create()).resolves.toEqual(
        expect.objectContaining({ androidTargetSdkVersion: mockValue }),
      );
    });

    it('returns the custom parameters', async () => {
      const mockValue = '-profile SomeProfile -someBoolean -someValue exampleValue';
      jest.spyOn(Input, 'customParameters', 'get').mockReturnValue(mockValue);
      expect(BuildParameters.create()).resolves.toEqual(expect.objectContaining({ customParameters: mockValue }));
    });
  });
});
