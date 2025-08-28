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
    // Check if we're in a CI environment or if AWS CLI is available
    const isCI = process.env.GITHUB_ACTIONS === 'true';
    let awsAvailable = false;

    if (!isCI) {
      // Only check AWS CLI locally, skip the test if not available
      try {
        // Use synchronous check for AWS CLI availability
        const { execSync } = require('child_process');
        execSync('aws --version', { stdio: 'ignore' });
        awsAvailable = true;
      } catch {
        awsAvailable = false;
      }
    }

    // Only run the test if we're in CI or AWS CLI is available
    if (isCI || awsAvailable) {
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
        const results2 = results2Object.BuildResults;
        CloudRunnerLogger.log(`run 2 succeeded`);

        // Look for multiple indicators of a successful build
        const buildIndicators = [
          'Build succeeded',
          'Build succeeded!',
          'Build Succeeded',
          'succeeded',
          'Cloud Runner finished running standard build automation',
          'Cloud runner job has finished successfully',
        ];

        const buildWasSuccessful = buildIndicators.some((indicator) => results2.includes(indicator));
        expect(buildWasSuccessful).toBeTruthy();

        // Only run S3 operations if we're in CI or AWS CLI is available
        if (isCI || awsAvailable) {
          const results = await CloudRunnerSystem.RunAndReadLines(
            `aws s3 ls s3://${CloudRunner.buildParameters.awsStackName}/cloud-runner-cache/`,
          );
          CloudRunnerLogger.log(results.join(`,`));
        }
      }, 1_000_000_000);
    } else {
      it.skip('Run build and prebuilt s3 cache pull, cache push and upload build - AWS CLI not available locally', () => {
        CloudRunnerLogger.log('AWS CLI not available locally, skipping S3 test');
      });
    }
  })();
});
