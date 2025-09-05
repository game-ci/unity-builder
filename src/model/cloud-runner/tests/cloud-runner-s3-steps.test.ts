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

describe('Cloud Runner pre-built S3 steps', () => {
  it('Responds', () => {});
  it('Simple test to check if file is loaded', () => {
    expect(true).toBe(true);
  });
  setups();
  (() => {
    // Determine environment capability to run S3 operations
    const isCI = process.env.GITHUB_ACTIONS === 'true';
    let awsAvailable = false;
    if (!isCI) {
      try {
        const { execSync } = require('child_process');
        execSync('aws --version', { stdio: 'ignore' });
        awsAvailable = true;
      } catch {
        awsAvailable = false;
      }
    }
    const hasAwsCreds = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
    const shouldRunS3 = (isCI && hasAwsCreds) || awsAvailable;

    // Only run the test if we have AWS creds in CI, or the AWS CLI is available locally
    if (shouldRunS3) {
      it('Run build and prebuilt s3 cache pull, cache push and upload build', async () => {
        const overrides = {
          versioning: 'None',
          projectPath: 'test-project',
          unityVersion: UnityVersioning.determineUnityVersion('test-project', UnityVersioning.read('test-project')),
          targetPlatform: 'StandaloneLinux64',
          cacheKey: `test-case-${uuidv4()}`,
          containerHookFiles: `aws-s3-pull-cache,aws-s3-upload-cache,aws-s3-upload-build`,
          cloudRunnerDebug: true,
        };
        const buildParameter2 = await CreateParameters(overrides);
        const baseImage2 = new ImageTag(buildParameter2);
        const results2Object = await CloudRunner.run(buildParameter2, baseImage2.toString());
        CloudRunnerLogger.log(`run 2 succeeded`);
        expect(results2Object.BuildSucceeded).toBe(true);

        // Only run S3 operations if environment supports it
        if (shouldRunS3) {
          const results = await CloudRunnerSystem.RunAndReadLines(
            `aws s3 ls s3://${CloudRunner.buildParameters.awsStackName}/cloud-runner-cache/`,
          );
          CloudRunnerLogger.log(results.join(`,`));
        }
      }, 1_000_000_000);
    } else {
      it.skip('Run build and prebuilt s3 cache pull, cache push and upload build - AWS not configured', () => {
        CloudRunnerLogger.log('AWS not configured (no creds/CLI); skipping S3 test');
      });
    }
  })();
});
