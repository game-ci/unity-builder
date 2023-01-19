import CloudRunner from '../cloud-runner';
import { BuildParameters, ImageTag } from '../..';
import UnityVersioning from '../../unity-versioning';
import { Cli } from '../../cli/cli';
import CloudRunnerLogger from '../services/cloud-runner-logger';
import { v4 as uuidv4 } from 'uuid';
import CloudRunnerOptions from '../cloud-runner-options';
import setups from './cloud-runner-suite.test';
import { CloudRunnerSystem } from '../services/cloud-runner-system';

async function CreateParameters(overrides) {
  if (overrides) {
    Cli.options = overrides;
  }

  return await BuildParameters.create();
}

describe('Cloud Runner pre-built S3 steps', () => {
  it('Responds', () => {});
  setups();
  if (CloudRunnerOptions.cloudRunnerDebug && CloudRunnerOptions.cloudRunnerCluster !== `local-docker`) {
    it('Run build and prebuilt s3 cache pull, cache push and upload build', async () => {
      const overrides = {
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.determineUnityVersion('test-project', UnityVersioning.read('test-project')),
        targetPlatform: 'StandaloneLinux64',
        cacheKey: `test-case-${uuidv4()}`,
        customStepFiles: `aws-s3-pull-cache,aws-s3-upload-cache,aws-s3-upload-build`,
      };
      const buildParameter2 = await CreateParameters(overrides);
      const baseImage2 = new ImageTag(buildParameter2);
      const results2 = await CloudRunner.run(buildParameter2, baseImage2.toString());
      CloudRunnerLogger.log(`run 2 succeeded`);

      const build2ContainsBuildSucceeded = results2.includes('Build succeeded');
      expect(build2ContainsBuildSucceeded).toBeTruthy();

      const results = await CloudRunnerSystem.RunAndReadLines(
        `aws s3 ls s3://${CloudRunner.buildParameters.awsBaseStackName}/cloud-runner-cache/${buildParameter2.cacheKey}/`,
      );
      CloudRunnerLogger.log(results.join(`,`));
    }, 1_000_000_000);
  }
});
