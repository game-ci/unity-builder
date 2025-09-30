import CloudRunner from '../cloud-runner';
import { BuildParameters, ImageTag } from '../..';
import UnityVersioning from '../../unity-versioning';
import { Cli } from '../../cli/cli';
import CloudRunnerLogger from '../services/core/cloud-runner-logger';
import { v4 as uuidv4 } from 'uuid';
import setups from './cloud-runner-suite.test';
import { CloudRunnerSystem } from '../services/core/cloud-runner-system';
import { OptionValues } from 'commander';

async function CreateParameters(overrides: OptionValues | undefined) {
  if (overrides) {
    Cli.options = overrides;
  }

  return await BuildParameters.create();
}

describe('Cloud Runner pre-built rclone steps', () => {
  it('Responds', () => {});
  it('Simple test to check if file is loaded', () => {
    expect(true).toBe(true);
  });
  setups();

  (() => {
    // Determine environment capability to run rclone operations
    const isCI = process.env.GITHUB_ACTIONS === 'true';
    const isWindows = process.platform === 'win32';
    let rcloneAvailable = false;
    let bashAvailable = !isWindows; // assume available on non-Windows
    if (!isCI) {
      try {
        const { execSync } = require('child_process');
        execSync('rclone version', { stdio: 'ignore' });
        rcloneAvailable = true;
      } catch {
        rcloneAvailable = false;
      }
      if (isWindows) {
        try {
          const { execSync } = require('child_process');
          execSync('bash --version', { stdio: 'ignore' });
          bashAvailable = true;
        } catch {
          bashAvailable = false;
        }
      }
    }

    const hasRcloneRemote = Boolean(process.env.RCLONE_REMOTE || process.env.rcloneRemote);
    const shouldRunRclone = (isCI && hasRcloneRemote) || (rcloneAvailable && (!isWindows || bashAvailable));

    if (shouldRunRclone) {
      it('Run build and prebuilt rclone cache pull, cache push and upload build', async () => {
        const remote = process.env.RCLONE_REMOTE || process.env.rcloneRemote || 'local:./temp/rclone-remote';
        const overrides = {
          versioning: 'None',
          projectPath: 'test-project',
          unityVersion: UnityVersioning.determineUnityVersion('test-project', UnityVersioning.read('test-project')),
          targetPlatform: 'StandaloneLinux64',
          cacheKey: `test-case-${uuidv4()}`,
          containerHookFiles: `rclone-pull-cache,rclone-upload-cache,rclone-upload-build`,
          storageProvider: 'rclone',
          rcloneRemote: remote,
          cloudRunnerDebug: true,
        } as unknown as OptionValues;

        const buildParams = await CreateParameters(overrides);
        const baseImage = new ImageTag(buildParams);
        const results = await CloudRunner.run(buildParams, baseImage.toString());
        CloudRunnerLogger.log(`rclone run succeeded`);
        expect(results.BuildSucceeded).toBe(true);

        // List remote root to validate the remote is accessible (best-effort)
        try {
          const lines = await CloudRunnerSystem.RunAndReadLines(`rclone lsf ${remote}`);
          CloudRunnerLogger.log(lines.join(','));
        } catch {}
      }, 1_000_000_000);
    } else {
      it.skip('Run build and prebuilt rclone steps - rclone not configured', () => {
        CloudRunnerLogger.log('rclone not configured (no CLI/remote); skipping rclone test');
      });
    }
  })();
});
