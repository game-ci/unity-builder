import CloudRunner from '../cloud-runner';
import { BuildParameters, ImageTag } from '../..';
import UnityVersioning from '../../unity-versioning';
import { Cli } from '../../cli/cli';
import CloudRunnerLogger from '../services/cloud-runner-logger';
import { v4 as uuidv4 } from 'uuid';
import CloudRunnerOptions from '../cloud-runner-options';
import GitHub from '../../github';

async function CreateParameters(overrides) {
  if (overrides) {
    Cli.options = overrides;
  }
  const originalValue = GitHub.githubInputEnabled;
  GitHub.githubInputEnabled = false;
  const results = await BuildParameters.create();
  GitHub.githubInputEnabled = originalValue;
  delete Cli.options;

  return results;
}

describe('Cloud Runner Caching', () => {
  it('Responds', () => {});
});
describe('Cloud Runner Caching', () => {
  if (CloudRunnerOptions.cloudRunnerTests) {
    it('Run one build it should not use cache, run subsequent build which should use cache', async () => {
      const overrides = {
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.determineUnityVersion('test-project', UnityVersioning.read('test-project')),
        targetPlatform: 'StandaloneLinux64',
        cacheKey: `test-case-${uuidv4()}`,
      };
      const buildParameter = await CreateParameters(overrides);
      expect(buildParameter.projectPath).toEqual(overrides.projectPath);

      const baseImage = new ImageTag(buildParameter);
      const results = await CloudRunner.run(buildParameter, baseImage.toString());
      const libraryString = 'Rebuilding Library because the asset database could not be found!';
      const buildSucceededString = 'Build succeeded';

      expect(results).toContain(libraryString);
      expect(results).toContain(buildSucceededString);
      expect(results).not.toContain('There is 0 files/dir in the source folder Library');
      expect(results).not.toContain('There is 0 files/dir in the source folder LFS');

      CloudRunnerLogger.log(`run 1 succeeded`);
      const buildParameter2 = await CreateParameters(overrides);
      const baseImage2 = new ImageTag(buildParameter2);
      const results2 = await CloudRunner.run(buildParameter2, baseImage2.toString());
      CloudRunnerLogger.log(`run 2 succeeded`);

      expect(results2).toContain(buildSucceededString);
      expect(results2).not.toContain('There is 0 files/dir in the cache pulled contents for Library');
      expect(results2).not.toContain('There is 0 files/dir in the cache pulled contents for LFS');
      expect(results2).not.toContain(libraryString);
    }, 1000000);
  }
});
