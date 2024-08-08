import CloudRunner from '../../cloud-runner';
import { BuildParameters, ImageTag } from '../../..';
import UnityVersioning from '../../../unity-versioning';
import { Cli } from '../../../cli/cli';
import CloudRunnerLogger from '../../services/core/cloud-runner-logger';
import { v4 as uuidv4 } from 'uuid';
import CloudRunnerOptions from '../../options/cloud-runner-options';
import setups from './../cloud-runner-suite.test';

async function CreateParameters(overrides: any) {
  if (overrides) {
    Cli.options = overrides;
  }

  return await BuildParameters.create();
}

describe('Cloud Runner RClone Hooks And Steps', () => {
  it('Responds', () => {});
  setups();
  if (CloudRunnerOptions.cloudRunnerDebug) {
    it('Run build with rclone steps', async () => {
      const overrides = {
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.determineUnityVersion('test-project', UnityVersioning.read('test-project')),
        targetPlatform: 'StandaloneLinux64',
        cacheKey: `test-case-${uuidv4()}`,
        commandHookFiles: `rclone-pre-build`,
        customJob: `
        - name: 'step 1'
          image: 'ubuntu'
          commands: 'echo "my test"'
        `,
      };
      const buildParameter2 = await CreateParameters(overrides);
      const baseImage2 = new ImageTag(buildParameter2);
      await CloudRunner.run(buildParameter2, baseImage2.toString());
      CloudRunnerLogger.log(`rclone run succeeded`);
    }, 1_000_000_000);
  }
});
