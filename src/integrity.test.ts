import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll, test } from 'vitest';
import { stat } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';

describe('Integrity tests', () => {
  describe('package-lock.json', () => {
    it('does not exist', async () => {
      await expect(stat(`${process.cwd()}/package-lock.json`)).rejects.toThrowError();
    });
  });

  describe('mac licensing scripts', () => {
    it('activate script switches Unity Licensing Client path for Unity 6000.3+', async () => {
      const activateScriptPath = `${process.cwd()}/dist/platforms/mac/steps/activate.sh`;
      const activateScript = await readFile(activateScriptPath, 'utf8');

      expect(activateScript).toContain('UNITY_LICENSING_CLIENT_SUBDIR="Frameworks"');
      expect(activateScript).toContain('UNITY_LICENSING_CLIENT_SUBDIR="Helpers"');
      expect(activateScript).toContain('^6000\\.([3-9]|[1-9][0-9])');
      expect(activateScript).toContain('https://docs.unity.com/en-us/licensing-server/client-config');
      expect(activateScript).toContain(
        '"$UNITY_EDITOR_DIR/Contents/$UNITY_LICENSING_CLIENT_SUBDIR/UnityLicensingClient.app/Contents/MacOS/Unity.Licensing.Client"',
      );
    });

    it('return license script uses the same Unity version-gated path logic', async () => {
      const returnLicenseScriptPath = `${process.cwd()}/dist/platforms/mac/steps/return_license.sh`;
      const returnLicenseScript = await readFile(returnLicenseScriptPath, 'utf8');

      expect(returnLicenseScript).toContain('UNITY_LICENSING_CLIENT_SUBDIR="Frameworks"');
      expect(returnLicenseScript).toContain('UNITY_LICENSING_CLIENT_SUBDIR="Helpers"');
      expect(returnLicenseScript).toContain('^6000\\.([3-9]|[1-9][0-9])');
      expect(returnLicenseScript).toContain('https://docs.unity.com/en-us/licensing-server/client-config');
      expect(returnLicenseScript).toContain(
        '"$UNITY_EDITOR_DIR/Contents/$UNITY_LICENSING_CLIENT_SUBDIR/UnityLicensingClient.app/Contents/MacOS/Unity.Licensing.Client"',
      );
    });
  });
});
