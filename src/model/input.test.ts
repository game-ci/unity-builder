import * as core from '@actions/core';

import Input from './input';
import Platform from './platform';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Input', () => {
  describe('unityVersion', () => {
    it('returns the default value', () => {
      expect(Input.unityVersion).toStrictEqual('auto');
    });

    it('takes input from the users workflow', () => {
      const mockValue = '2020.4.99f9';
      const spy = jest.spyOn(core, 'getInput').mockReturnValue(mockValue);
      expect(Input.unityVersion).toStrictEqual(mockValue);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
  describe('customImage', () => {
    it('returns the default value', () => {
      expect(Input.customImage).toStrictEqual('');
    });

    it('takes input from the users workflow', () => {
      const mockValue = '2020.4.99f9';
      const spy = jest.spyOn(core, 'getInput').mockReturnValue(mockValue);
      expect(Input.customImage).toStrictEqual(mockValue);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('targetPlatform', () => {
    it('returns the default value', () => {
      expect(Input.targetPlatform).toStrictEqual(Platform.default);
    });

    it('takes input from the users workflow', () => {
      const mockValue = 'Android';
      const spy = jest.spyOn(core, 'getInput').mockReturnValue(mockValue);
      expect(Input.targetPlatform).toStrictEqual(mockValue);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('projectPath', () => {
    it('returns the default value', () => {
      expect(Input.projectPath).toStrictEqual('test-project');
    });

    it('takes input from the users workflow', () => {
      const mockValue = 'customProjectPath';
      const spy = jest.spyOn(core, 'getInput').mockReturnValue(mockValue);
      expect(Input.projectPath).toStrictEqual(mockValue);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('buildName', () => {
    it('returns the default value', () => {
      expect(Input.buildName).toStrictEqual(Input.targetPlatform);
    });

    it('takes input from the users workflow', () => {
      const mockValue = 'Build';
      const spy = jest.spyOn(core, 'getInput').mockReturnValue(mockValue);
      expect(Input.buildName).toStrictEqual(mockValue);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('takes special characters as input', () => {
      const mockValue = '1ßúëld2';
      jest.spyOn(core, 'getInput').mockReturnValue(mockValue);
      expect(Input.buildName).toStrictEqual(mockValue);
    });
  });

  describe('buildsPath', () => {
    it('returns the default value', () => {
      expect(Input.buildsPath).toStrictEqual('build');
    });

    it('takes input from the users workflow', () => {
      const mockValue = 'customBuildsPath';
      const spy = jest.spyOn(core, 'getInput').mockReturnValue(mockValue);
      expect(Input.buildsPath).toStrictEqual(mockValue);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('buildMethod', () => {
    it('returns the default value', () => {
      expect(Input.buildMethod).toStrictEqual('');
    });

    it('takes input from the users workflow', () => {
      const mockValue = 'Namespace.ClassName.Method';
      const spy = jest.spyOn(core, 'getInput').mockReturnValue(mockValue);
      expect(Input.buildMethod).toStrictEqual(mockValue);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('manualExit', () => {
    it('returns the default value', () => {
      expect(Input.manualExit).toStrictEqual(false);
    });

    it('returns true when string true is passed', () => {
      const spy = jest.spyOn(core, 'getInput').mockReturnValue('true');
      expect(Input.manualExit).toStrictEqual(true);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('returns false when string false is passed', () => {
      const spy = jest.spyOn(core, 'getInput').mockReturnValue('false');
      expect(Input.manualExit).toStrictEqual(false);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('enableGpu', () => {
    it('returns the default value', () => {
      expect(Input.enableGpu).toStrictEqual(false);
    });

    it('returns true when string true is passed', () => {
      const spy = jest.spyOn(core, 'getInput').mockReturnValue('true');
      expect(Input.enableGpu).toStrictEqual(true);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('returns false when string false is passed', () => {
      const spy = jest.spyOn(core, 'getInput').mockReturnValue('false');
      expect(Input.enableGpu).toStrictEqual(false);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('versioningStrategy', () => {
    it('returns the default value', () => {
      expect(Input.versioningStrategy).toStrictEqual('Semantic');
    });

    it('takes input from the users workflow', () => {
      const mockValue = 'Anything';
      const spy = jest.spyOn(core, 'getInput').mockReturnValue(mockValue);
      expect(Input.versioningStrategy).toStrictEqual(mockValue);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('specifiedVersion', () => {
    it('returns the default value', () => {
      expect(Input.specifiedVersion).toStrictEqual('');
    });

    it('takes input from the users workflow', () => {
      const mockValue = '1.33.7';
      const spy = jest.spyOn(core, 'getInput').mockReturnValue(mockValue);
      expect(Input.specifiedVersion).toStrictEqual(mockValue);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('androidVersionCode', () => {
    it('defaults to null', () => {
      expect(Input.androidVersionCode).toBeFalsy();
    });

    it('takes input from the users workflow', () => {
      const mockValue = '42';
      const spy = jest.spyOn(core, 'getInput').mockReturnValue(mockValue);
      expect(Input.androidVersionCode).toStrictEqual(mockValue);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('androidExportType', () => {
    it('returns the default value', () => {
      expect(Input.androidExportType).toStrictEqual('androidPackage');
    });

    test.each`
      input                     | expected
      ${'androidPackage'}       | ${'androidPackage'}
      ${'androidAppBundle'}     | ${'androidAppBundle'}
      ${'androidStudioProject'} | ${'androidStudioProject'}
    `('returns $expected when $input is passed', ({ input, expected }) => {
      const spy = jest.spyOn(core, 'getInput').mockReturnValue(input);
      expect(Input.androidExportType).toStrictEqual(expected);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('androidSymbolType', () => {
    it('returns the default value', () => {
      expect(Input.androidSymbolType).toStrictEqual('none');
    });

    test.each`
      input          | expected
      ${'none'}      | ${'none'}
      ${'public'}    | ${'public'}
      ${'debugging'} | ${'debugging'}
    `('returns $expected when $input is passed', ({ input, expected }) => {
      const spy = jest.spyOn(core, 'getInput').mockReturnValue(input);
      expect(Input.androidExportType).toStrictEqual(expected);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('androidKeystoreName', () => {
    it('returns the default value', () => {
      expect(Input.androidKeystoreName).toStrictEqual('');
    });

    it('takes input from the users workflow', () => {
      const mockValue = 'keystore.keystore';
      const spy = jest.spyOn(core, 'getInput').mockReturnValue(mockValue);
      expect(Input.androidKeystoreName).toStrictEqual(mockValue);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('androidKeystoreBase64', () => {
    it('returns the default value', () => {
      expect(Input.androidKeystoreBase64).toStrictEqual('');
    });

    it('takes input from the users workflow', () => {
      const mockValue = 'secret';
      const spy = jest.spyOn(core, 'getInput').mockReturnValue(mockValue);
      expect(Input.androidKeystoreBase64).toStrictEqual(mockValue);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('androidKeystorePass', () => {
    it('returns the default value', () => {
      expect(Input.androidKeystorePass).toStrictEqual('');
    });

    it('takes input from the users workflow', () => {
      const mockValue = 'secret';
      const spy = jest.spyOn(core, 'getInput').mockReturnValue(mockValue);
      expect(Input.androidKeystorePass).toStrictEqual(mockValue);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('androidKeyaliasName', () => {
    it('returns the default value', () => {
      expect(Input.androidKeyaliasName).toStrictEqual('');
    });

    it('takes input from the users workflow', () => {
      const mockValue = 'secret';
      const spy = jest.spyOn(core, 'getInput').mockReturnValue(mockValue);
      expect(Input.androidKeyaliasName).toStrictEqual(mockValue);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('androidKeyaliasPass', () => {
    it('returns the default value', () => {
      expect(Input.androidKeyaliasPass).toStrictEqual('');
    });

    it('takes input from the users workflow', () => {
      const mockValue = 'secret';
      const spy = jest.spyOn(core, 'getInput').mockReturnValue(mockValue);
      expect(Input.androidKeyaliasPass).toStrictEqual(mockValue);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('androidTargetSdkVersion', () => {
    it('returns the default value', () => {
      expect(Input.androidTargetSdkVersion).toStrictEqual('');
    });

    it('takes input from the users workflow', () => {
      const mockValue = 'secret';
      const spy = jest.spyOn(core, 'getInput').mockReturnValue(mockValue);
      expect(Input.androidTargetSdkVersion).toStrictEqual(mockValue);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('allowDirtyBuild', () => {
    it('returns the default value', () => {
      expect(Input.allowDirtyBuild).toStrictEqual(false);
    });

    it('returns true when string true is passed', () => {
      const spy = jest.spyOn(core, 'getInput').mockReturnValue('true');
      expect(Input.allowDirtyBuild).toStrictEqual(true);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('returns false when string false is passed', () => {
      const spy = jest.spyOn(core, 'getInput').mockReturnValue('false');
      expect(Input.allowDirtyBuild).toStrictEqual(false);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('customParameters', () => {
    it('returns the default value', () => {
      expect(Input.customParameters).toStrictEqual('');
    });

    it('takes input from the users workflow', () => {
      const mockValue = '-imAFlag';
      const spy = jest.spyOn(core, 'getInput').mockReturnValue(mockValue);
      expect(Input.customParameters).toStrictEqual(mockValue);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
