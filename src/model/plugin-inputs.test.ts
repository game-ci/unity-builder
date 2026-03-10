/**
 * Tests for plugin input properties and their wiring into BuildParameters.
 *
 * Covers all 20 new input properties added for plugin features:
 * - Boolean inputs: localCacheEnabled, childWorkspacesEnabled, gitHooksEnabled,
 *   localCacheLibrary, localCacheLfs, childWorkspacePreserveGit, childWorkspaceSeparateLibrary
 * - String inputs: submoduleProfilePath, submoduleVariantPath, submoduleToken,
 *   localCacheRoot, childWorkspaceName, childWorkspaceCacheRoot, lfsTransferAgent,
 *   lfsTransferAgentArgs, lfsStoragePaths, providerExecutable, gitHooksSkipList,
 *   gitHooksRunBeforeBuild
 *
 * Special attention to boolean inputs: GitHub Actions always passes inputs as strings,
 * so 'false' must NOT evaluate as truthy (the #1 source of bugs).
 */

import * as core from '@actions/core';
import Input from './input';
import Versioning from './versioning';
import BuildParameters from './build-parameters';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Part 1: Input getters — defaults and explicit values
// ---------------------------------------------------------------------------

describe('Plugin Input properties', () => {
  // -----------------------------------------------------------------------
  // Boolean inputs — default and string parsing
  // -----------------------------------------------------------------------

  describe('localCacheEnabled', () => {
    it('returns false by default', () => {
      expect(Input.localCacheEnabled).toBe(false);
    });

    it('returns true when string "true" is passed', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('true');
      expect(Input.localCacheEnabled).toBe(true);
    });

    it('returns false when string "false" is passed', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('false');
      expect(Input.localCacheEnabled).toBe(false);
    });

    it('returns false when empty string is passed', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('');
      expect(Input.localCacheEnabled).toBe(false);
    });
  });

  describe('localCacheLibrary', () => {
    it('returns true by default (library caching on by default when cache enabled)', () => {
      expect(Input.localCacheLibrary).toBe(true);
    });

    it('returns true when string "true" is passed', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('true');
      expect(Input.localCacheLibrary).toBe(true);
    });

    it('returns false when string "false" is passed', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('false');
      expect(Input.localCacheLibrary).toBe(false);
    });
  });

  describe('localCacheLfs', () => {
    it('returns false by default', () => {
      expect(Input.localCacheLfs).toBe(false);
    });

    it('returns true when string "true" is passed', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('true');
      expect(Input.localCacheLfs).toBe(true);
    });

    it('returns false when string "false" is passed', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('false');
      expect(Input.localCacheLfs).toBe(false);
    });
  });

  describe('childWorkspacesEnabled', () => {
    it('returns false by default', () => {
      expect(Input.childWorkspacesEnabled).toBe(false);
    });

    it('returns true when string "true" is passed', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('true');
      expect(Input.childWorkspacesEnabled).toBe(true);
    });

    it('returns false when string "false" is passed', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('false');
      expect(Input.childWorkspacesEnabled).toBe(false);
    });

    it('returns false when empty string is passed', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('');
      expect(Input.childWorkspacesEnabled).toBe(false);
    });
  });

  describe('childWorkspacePreserveGit', () => {
    it('returns true by default', () => {
      expect(Input.childWorkspacePreserveGit).toBe(true);
    });

    it('returns false when string "false" is passed', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('false');
      expect(Input.childWorkspacePreserveGit).toBe(false);
    });

    it('returns true when string "true" is passed', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('true');
      expect(Input.childWorkspacePreserveGit).toBe(true);
    });
  });

  describe('childWorkspaceSeparateLibrary', () => {
    it('returns true by default', () => {
      expect(Input.childWorkspaceSeparateLibrary).toBe(true);
    });

    it('returns false when string "false" is passed', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('false');
      expect(Input.childWorkspaceSeparateLibrary).toBe(false);
    });

    it('returns true when string "true" is passed', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('true');
      expect(Input.childWorkspaceSeparateLibrary).toBe(true);
    });
  });

  describe('gitHooksEnabled', () => {
    it('returns false by default', () => {
      expect(Input.gitHooksEnabled).toBe(false);
    });

    it('returns true when string "true" is passed', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('true');
      expect(Input.gitHooksEnabled).toBe(true);
    });

    it('returns false when string "false" is passed', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('false');
      expect(Input.gitHooksEnabled).toBe(false);
    });

    it('returns false when empty string is passed', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('');
      expect(Input.gitHooksEnabled).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Boolean truthiness edge cases — the #1 source of bugs
  // -----------------------------------------------------------------------

  describe('boolean input string handling (edge cases)', () => {
    // These tests verify that the === 'true' comparison is correct.
    // In JavaScript, 'false' is truthy when used in a boolean context,
    // but the Input class correctly uses === 'true' comparison.

    const booleanInputs: Array<{
      name: string;
      getter: () => boolean;
      defaultValue: boolean;
    }> = [
      { name: 'localCacheEnabled', getter: () => Input.localCacheEnabled, defaultValue: false },
      { name: 'localCacheLfs', getter: () => Input.localCacheLfs, defaultValue: false },
      { name: 'childWorkspacesEnabled', getter: () => Input.childWorkspacesEnabled, defaultValue: false },
      { name: 'gitHooksEnabled', getter: () => Input.gitHooksEnabled, defaultValue: false },

      // These default to true:
      { name: 'localCacheLibrary', getter: () => Input.localCacheLibrary, defaultValue: true },
      { name: 'childWorkspacePreserveGit', getter: () => Input.childWorkspacePreserveGit, defaultValue: true },
      { name: 'childWorkspaceSeparateLibrary', getter: () => Input.childWorkspaceSeparateLibrary, defaultValue: true },
    ];

    test.each(booleanInputs)('$name: "false" string does NOT evaluate as truthy', ({ getter }) => {
      jest.spyOn(core, 'getInput').mockReturnValue('false');
      expect(getter()).toBe(false);
    });

    test.each(booleanInputs)('$name: "true" string evaluates as truthy', ({ getter }) => {
      jest.spyOn(core, 'getInput').mockReturnValue('true');
      expect(getter()).toBe(true);
    });

    test.each(booleanInputs)('$name: "TRUE" (uppercase) does NOT evaluate as true (case sensitive)', ({ getter }) => {
      jest.spyOn(core, 'getInput').mockReturnValue('TRUE');
      expect(getter()).toBe(false);
    });

    test.each(booleanInputs)('$name: "1" does NOT evaluate as true', ({ getter }) => {
      jest.spyOn(core, 'getInput').mockReturnValue('1');
      expect(getter()).toBe(false);
    });

    test.each(booleanInputs)('$name: "yes" does NOT evaluate as true', ({ getter }) => {
      jest.spyOn(core, 'getInput').mockReturnValue('yes');
      expect(getter()).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // String inputs — defaults and explicit values
  // -----------------------------------------------------------------------

  describe('submoduleProfilePath', () => {
    it('returns empty string by default', () => {
      expect(Input.submoduleProfilePath).toBe('');
    });

    it('takes input from workflow', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('config/submodule-profiles/tow/ec/profile.yml');
      expect(Input.submoduleProfilePath).toBe('config/submodule-profiles/tow/ec/profile.yml');
    });
  });

  describe('submoduleVariantPath', () => {
    it('returns empty string by default', () => {
      expect(Input.submoduleVariantPath).toBe('');
    });

    it('takes input from workflow', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('config/submodule-profiles/tow/ec/server.yml');
      expect(Input.submoduleVariantPath).toBe('config/submodule-profiles/tow/ec/server.yml');
    });
  });

  describe('submoduleToken', () => {
    it('returns empty string by default', () => {
      expect(Input.submoduleToken).toBe('');
    });

    it('takes input from workflow', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('ghp_abc123');
      expect(Input.submoduleToken).toBe('ghp_abc123');
    });
  });

  describe('localCacheRoot', () => {
    it('returns empty string by default', () => {
      expect(Input.localCacheRoot).toBe('');
    });

    it('takes input from workflow', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('/d/cache/game-ci');
      expect(Input.localCacheRoot).toBe('/d/cache/game-ci');
    });
  });

  describe('childWorkspaceName', () => {
    it('returns empty string by default', () => {
      expect(Input.childWorkspaceName).toBe('');
    });

    it('takes input from workflow', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('TurnOfWarEndlessCrusade');
      expect(Input.childWorkspaceName).toBe('TurnOfWarEndlessCrusade');
    });
  });

  describe('childWorkspaceCacheRoot', () => {
    it('returns empty string by default', () => {
      expect(Input.childWorkspaceCacheRoot).toBe('');
    });

    it('takes input from workflow', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('/d/workspaces');
      expect(Input.childWorkspaceCacheRoot).toBe('/d/workspaces');
    });
  });

  describe('lfsTransferAgent', () => {
    it('returns empty string by default', () => {
      expect(Input.lfsTransferAgent).toBe('');
    });

    it('takes input from workflow', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('/tools/elastic-git-storage');
      expect(Input.lfsTransferAgent).toBe('/tools/elastic-git-storage');
    });
  });

  describe('lfsTransferAgentArgs', () => {
    it('returns empty string by default', () => {
      expect(Input.lfsTransferAgentArgs).toBe('');
    });

    it('takes input from workflow', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('--verbose --timeout=60');
      expect(Input.lfsTransferAgentArgs).toBe('--verbose --timeout=60');
    });
  });

  describe('lfsStoragePaths', () => {
    it('returns empty string by default', () => {
      expect(Input.lfsStoragePaths).toBe('');
    });

    it('takes input from workflow', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('/storage/primary;/storage/secondary');
      expect(Input.lfsStoragePaths).toBe('/storage/primary;/storage/secondary');
    });
  });

  describe('providerExecutable', () => {
    it('returns empty string by default', () => {
      expect(Input.providerExecutable).toBe('');
    });

    it('takes input from workflow', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('/usr/local/bin/custom-provider');
      expect(Input.providerExecutable).toBe('/usr/local/bin/custom-provider');
    });
  });

  describe('gitHooksSkipList', () => {
    it('returns empty string by default', () => {
      expect(Input.gitHooksSkipList).toBe('');
    });

    it('takes input from workflow', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('pre-commit,pre-push');
      expect(Input.gitHooksSkipList).toBe('pre-commit,pre-push');
    });
  });

  describe('gitHooksRunBeforeBuild', () => {
    it('returns empty string by default', () => {
      expect(Input.gitHooksRunBeforeBuild).toBe('');
    });

    it('takes input from workflow', () => {
      jest.spyOn(core, 'getInput').mockReturnValue('pre-commit');
      expect(Input.gitHooksRunBeforeBuild).toBe('pre-commit');
    });
  });
});

// ---------------------------------------------------------------------------
// Part 2: BuildParameters.create() maps new inputs to properties
// ---------------------------------------------------------------------------

const testLicense =
  '<?xml version="1.0" encoding="UTF-8"?><root>\n    <License id="Terms">\n        <MachineBindings>\n            <Binding Key="1" Value="576562626572264761624c65526f7578"/>\n            <Binding Key="2" Value="576562626572264761624c65526f7578"/>\n        </MachineBindings>\n        <MachineID Value="D7nTUnjNAmtsUMcnoyrqkgIbYdM="/>\n        <SerialHash Value="2033b8ac3e6faa3742ca9f0bfae44d18f2a96b80"/>\n        <Features>\n            <Feature Value="33"/>\n            <Feature Value="1"/>\n            <Feature Value="12"/>\n            <Feature Value="2"/>\n            <Feature Value="24"/>\n            <Feature Value="3"/>\n            <Feature Value="36"/>\n            <Feature Value="17"/>\n            <Feature Value="19"/>\n            <Feature Value="62"/>\n        </Features>\n        <DeveloperData Value="AQAAAEY0LUJHUlgtWEQ0RS1aQ1dWLUM1SlctR0RIQg=="/>\n        <SerialMasked Value="F4-BGRX-XD4E-ZCWV-C5JW-XXXX"/>\n        <StartDate Value="2021-02-08T00:00:00"/>\n        <UpdateDate Value="2021-02-09T00:34:57"/>\n        <InitialActivationDate Value="2021-02-08T00:34:56"/>\n        <LicenseVersion Value="6.x"/>\n        <ClientProvidedVersion Value="2018.4.30f1"/>\n        <AlwaysOnline Value="false"/>\n        <Entitlements>\n            <Entitlement Ns="unity_editor" Tag="UnityPersonal" Type="EDITOR" ValidTo="9999-12-31T00:00:00"/>\n            <Entitlement Ns="unity_editor" Tag="DarkSkin" Type="EDITOR_FEATURE" ValidTo="9999-12-31T00:00:00"/>\n        </Entitlements>\n    </License>\n<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315#WithComments"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI="#Terms"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>m0Db8UK+ktnOLJBtHybkfetpcKo=</DigestValue></Reference></SignedInfo><SignatureValue>o/pUbSQAukz7+ZYAWhnA0AJbIlyyCPL7bKVEM2lVqbrXt7cyey+umkCXamuOgsWPVUKBMkXtMH8L\n5etLmD0getWIhTGhzOnDCk+gtIPfL4jMo9tkEuOCROQAXCci23VFscKcrkB+3X6h4wEOtA2APhOY\nB+wvC794o8/82ffjP79aVAi57rp3Wmzx+9pe9yMwoJuljAy2sc2tIMgdQGWVmOGBpQm3JqsidyzI\nJWG2kjnc7pDXK9pwYzXoKiqUqqrut90d+kQqRyv7MSZXR50HFqD/LI69h68b7P8Bjo3bPXOhNXGR\n9YCoemH6EkfCJxp2gIjzjWW+l2Hj2EsFQi8YXw==</SignatureValue></Signature></root>';

describe('BuildParameters.create() plugin property mapping', () => {
  beforeEach(() => {
    jest.spyOn(Versioning, 'determineBuildVersion').mockImplementation(async () => '1.3.37');
    process.env.UNITY_LICENSE = testLicense;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('maps submoduleProfilePath from Input', async () => {
    jest.spyOn(Input, 'submoduleProfilePath', 'get').mockReturnValue('/path/to/profile.yml');
    const parameters = await BuildParameters.create();
    expect(parameters.submoduleProfilePath).toBe('/path/to/profile.yml');
  });

  it('maps submoduleVariantPath from Input', async () => {
    jest.spyOn(Input, 'submoduleVariantPath', 'get').mockReturnValue('/path/to/variant.yml');
    const parameters = await BuildParameters.create();
    expect(parameters.submoduleVariantPath).toBe('/path/to/variant.yml');
  });

  it('maps submoduleToken from Input', async () => {
    jest.spyOn(Input, 'submoduleToken', 'get').mockReturnValue('ghp_token123');
    const parameters = await BuildParameters.create();
    expect(parameters.submoduleToken).toBe('ghp_token123');
  });

  it('maps localCacheEnabled from Input', async () => {
    jest.spyOn(Input, 'localCacheEnabled', 'get').mockReturnValue(true);
    const parameters = await BuildParameters.create();
    expect(parameters.localCacheEnabled).toBe(true);
  });

  it('maps localCacheRoot from Input', async () => {
    jest.spyOn(Input, 'localCacheRoot', 'get').mockReturnValue('/d/cache');
    const parameters = await BuildParameters.create();
    expect(parameters.localCacheRoot).toBe('/d/cache');
  });

  it('maps localCacheLibrary from Input', async () => {
    jest.spyOn(Input, 'localCacheLibrary', 'get').mockReturnValue(false);
    const parameters = await BuildParameters.create();
    expect(parameters.localCacheLibrary).toBe(false);
  });

  it('maps localCacheLfs from Input', async () => {
    jest.spyOn(Input, 'localCacheLfs', 'get').mockReturnValue(true);
    const parameters = await BuildParameters.create();
    expect(parameters.localCacheLfs).toBe(true);
  });

  it('maps childWorkspacesEnabled from Input', async () => {
    jest.spyOn(Input, 'childWorkspacesEnabled', 'get').mockReturnValue(true);
    const parameters = await BuildParameters.create();
    expect(parameters.childWorkspacesEnabled).toBe(true);
  });

  it('maps childWorkspaceName from Input', async () => {
    jest.spyOn(Input, 'childWorkspaceName', 'get').mockReturnValue('TurnOfWar');
    const parameters = await BuildParameters.create();
    expect(parameters.childWorkspaceName).toBe('TurnOfWar');
  });

  it('maps childWorkspaceCacheRoot from Input', async () => {
    jest.spyOn(Input, 'childWorkspaceCacheRoot', 'get').mockReturnValue('/cache/workspaces');
    const parameters = await BuildParameters.create();
    expect(parameters.childWorkspaceCacheRoot).toBe('/cache/workspaces');
  });

  it('maps childWorkspacePreserveGit from Input', async () => {
    jest.spyOn(Input, 'childWorkspacePreserveGit', 'get').mockReturnValue(false);
    const parameters = await BuildParameters.create();
    expect(parameters.childWorkspacePreserveGit).toBe(false);
  });

  it('maps childWorkspaceSeparateLibrary from Input', async () => {
    jest.spyOn(Input, 'childWorkspaceSeparateLibrary', 'get').mockReturnValue(false);
    const parameters = await BuildParameters.create();
    expect(parameters.childWorkspaceSeparateLibrary).toBe(false);
  });

  it('maps lfsTransferAgent from Input', async () => {
    jest.spyOn(Input, 'lfsTransferAgent', 'get').mockReturnValue('/tools/elastic-git-storage');
    const parameters = await BuildParameters.create();
    expect(parameters.lfsTransferAgent).toBe('/tools/elastic-git-storage');
  });

  it('maps lfsTransferAgentArgs from Input', async () => {
    jest.spyOn(Input, 'lfsTransferAgentArgs', 'get').mockReturnValue('--verbose');
    const parameters = await BuildParameters.create();
    expect(parameters.lfsTransferAgentArgs).toBe('--verbose');
  });

  it('maps lfsStoragePaths from Input', async () => {
    jest.spyOn(Input, 'lfsStoragePaths', 'get').mockReturnValue('/path/a;/path/b');
    const parameters = await BuildParameters.create();
    expect(parameters.lfsStoragePaths).toBe('/path/a;/path/b');
  });

  it('maps gitHooksEnabled from Input', async () => {
    jest.spyOn(Input, 'gitHooksEnabled', 'get').mockReturnValue(true);
    const parameters = await BuildParameters.create();
    expect(parameters.gitHooksEnabled).toBe(true);
  });

  it('maps gitHooksSkipList from Input', async () => {
    jest.spyOn(Input, 'gitHooksSkipList', 'get').mockReturnValue('pre-commit,pre-push');
    const parameters = await BuildParameters.create();
    expect(parameters.gitHooksSkipList).toBe('pre-commit,pre-push');
  });

  it('maps gitHooksRunBeforeBuild from Input', async () => {
    jest.spyOn(Input, 'gitHooksRunBeforeBuild', 'get').mockReturnValue('pre-commit');
    const parameters = await BuildParameters.create();
    expect(parameters.gitHooksRunBeforeBuild).toBe('pre-commit');
  });

  it('maps providerExecutable from Input', async () => {
    jest.spyOn(Input, 'providerExecutable', 'get').mockReturnValue('/usr/local/bin/provider');
    const parameters = await BuildParameters.create();
    expect(parameters.providerExecutable).toBe('/usr/local/bin/provider');
  });

  // Test that all plugin properties have correct defaults when not explicitly set
  it('has correct defaults for all plugin properties', async () => {
    const parameters = await BuildParameters.create();

    expect(parameters.submoduleProfilePath).toBe('');
    expect(parameters.submoduleVariantPath).toBe('');
    expect(parameters.submoduleToken).toBe('');
    expect(parameters.localCacheEnabled).toBe(false);
    expect(parameters.localCacheRoot).toBe('');
    expect(parameters.localCacheLibrary).toBe(true);
    expect(parameters.localCacheLfs).toBe(false);
    expect(parameters.childWorkspacesEnabled).toBe(false);
    expect(parameters.childWorkspaceName).toBe('');
    expect(parameters.childWorkspaceCacheRoot).toBe('');
    expect(parameters.childWorkspacePreserveGit).toBe(true);
    expect(parameters.childWorkspaceSeparateLibrary).toBe(true);
    expect(parameters.lfsTransferAgent).toBe('');
    expect(parameters.lfsTransferAgentArgs).toBe('');
    expect(parameters.lfsStoragePaths).toBe('');
    expect(parameters.gitHooksEnabled).toBe(false);
    expect(parameters.gitHooksSkipList).toBe('');
    expect(parameters.gitHooksRunBeforeBuild).toBe('');
    expect(parameters.providerExecutable).toBe('');
  });
});
