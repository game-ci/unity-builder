import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll, test } from 'vitest';
import { stat, mkdtemp, mkdir, writeFile, chmod, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

type ScriptKind = 'activate' | 'return';

async function makeExecutableFile(path: string, content: string): Promise<void> {
  await writeFile(path, content, 'utf8');
  await chmod(path, 0o755);
}

async function prepareMockUnityClient(editorDir: string): Promise<void> {
  const frameworkClientDir = join(
    editorDir,
    'Contents',
    'Frameworks',
    'UnityLicensingClient.app',
    'Contents',
    'MacOS',
  );
  const helperClientDir = join(
    editorDir,
    'Contents',
    'Helpers',
    'UnityLicensingClient.app',
    'Contents',
    'MacOS',
  );

  await mkdir(frameworkClientDir, { recursive: true });
  await mkdir(helperClientDir, { recursive: true });

  const mockClient = `#!/usr/bin/env bash
echo "$0" > "$CAPTURE_PATH_FILE"
if [[ "$1" == "--acquire-floating" ]]; then
  echo '"ok"'
  echo '"floating-license"'
  echo '"timeout"'
  echo '"3600"'
fi
`;

  await makeExecutableFile(join(frameworkClientDir, 'Unity.Licensing.Client'), mockClient);
  await makeExecutableFile(join(helperClientDir, 'Unity.Licensing.Client'), mockClient);
}

async function executeAndCaptureResolvedClientPath(
  sourceScriptPath: string,
  unityVersion: string,
  kind: ScriptKind,
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'unity-builder-integrity-'));
  const editorDir = join(root, 'mock-editor', 'Unity.app');
  const activatePath = join(root, 'activate-path');
  const unityLicensePath = join(root, 'unity-license-path');
  const actionFolder = join(root, 'action-folder');
  const unityConfigDir = join(actionFolder, 'unity-config');
  const capturePathFile = join(root, 'captured-client-path.txt');
  const localScriptPath = join(root, kind === 'activate' ? 'activate.sh' : 'return_license.sh');

  await mkdir(activatePath, { recursive: true });
  await mkdir(unityLicensePath, { recursive: true });
  await mkdir(unityConfigDir, { recursive: true });
  await writeFile(join(unityConfigDir, 'services-config.json'), '{}', 'utf8');
  await prepareMockUnityClient(editorDir);

  const scriptSource = await readFile(sourceScriptPath, 'utf8');
  const patchedScript = scriptSource.replace(
    'UNITY_EDITOR_DIR="/Applications/Unity/Hub/Editor/$UNITY_VERSION/Unity.app"',
    'UNITY_EDITOR_DIR="$TEST_UNITY_EDITOR_DIR"',
  );
  await makeExecutableFile(localScriptPath, patchedScript);

  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    TEST_UNITY_EDITOR_DIR: editorDir,
    ACTIVATE_LICENSE_PATH: activatePath,
    UNITY_LICENSE_PATH: unityLicensePath,
    ACTION_FOLDER: actionFolder,
    UNITY_LICENSING_SERVER: 'http://mock-server',
    UNITY_VERSION: unityVersion,
    CAPTURE_PATH_FILE: capturePathFile,
    UNITY_SERIAL: '',
    UNITY_EMAIL: '',
    UNITY_PASSWORD: '',
    FLOATING_LICENSE: 'floating-license',
  };

  await execFileAsync('bash', [localScriptPath], { env: environment });

  return (await readFile(capturePathFile, 'utf8')).trim();
}

async function expectVersionGateBehavior(scriptPath: string, kind: ScriptKind): Promise<void> {
  const belowGatePath = await executeAndCaptureResolvedClientPath(scriptPath, '6000.2.9f1', kind);
  const aboveGatePath = await executeAndCaptureResolvedClientPath(scriptPath, '6000.3.0f1', kind);

  expect(belowGatePath).toContain('/Contents/Frameworks/UnityLicensingClient.app/Contents/MacOS/Unity.Licensing.Client');
  expect(aboveGatePath).toContain('/Contents/Helpers/UnityLicensingClient.app/Contents/MacOS/Unity.Licensing.Client');
}

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

      expect(activateScript).toContain('https://docs.unity.com/en-us/licensing-server/client-config');
      await expectVersionGateBehavior(activateScriptPath, 'activate');
    });

    it('return license script uses the same Unity version-gated path logic', async () => {
      const returnLicenseScriptPath = `${process.cwd()}/dist/platforms/mac/steps/return_license.sh`;
      const returnLicenseScript = await readFile(returnLicenseScriptPath, 'utf8');

      expect(returnLicenseScript).toContain('https://docs.unity.com/en-us/licensing-server/client-config');
      await expectVersionGateBehavior(returnLicenseScriptPath, 'return');
    });
  });
});
