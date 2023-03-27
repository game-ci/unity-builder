import fs from 'node:fs';
import path from 'node:path';
import BuildParameters from '../../build-parameters';
import { Cli } from '../../cli/cli';
import UnityVersioning from '../../unity-versioning';
import CloudRunner from '../cloud-runner';
import { CloudRunnerSystem } from '../services/core/cloud-runner-system';
import { Caching } from '../remote-client/caching';
import { v4 as uuidv4 } from 'uuid';
import GitHub from '../../github';
import CloudRunnerOptions from '../options/cloud-runner-options';
describe('Cloud Runner (Remote Client) Caching', () => {
  it('responds', () => {});
  if (CloudRunnerOptions.providerStrategy === `local-docker`) {
    it('Simple caching works', async () => {
      Cli.options = {
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.read('test-project'),
        targetPlatform: 'StandaloneLinux64',
        cacheKey: `test-case-${uuidv4()}`,
      };
      GitHub.githubInputEnabled = false;
      const buildParameter = await BuildParameters.create();
      CloudRunner.buildParameters = buildParameter;

      // Create test folder
      const testFolder = path.resolve(__dirname, Cli.options.cacheKey);
      fs.mkdirSync(testFolder);

      // Create cache folder
      const cacheFolder = path.resolve(__dirname, `cache-${Cli.options.cacheKey}`);
      fs.mkdirSync(cacheFolder);

      // Add test file to test folders
      fs.writeFileSync(path.resolve(testFolder, 'test.txt'), Cli.options.cacheKey);
      await Caching.PushToCache(cacheFolder, testFolder, `${Cli.options.cacheKey}`);

      // Delete test folder
      fs.rmdirSync(testFolder, { recursive: true });
      await Caching.PullFromCache(
        cacheFolder.replace(/\\/g, `/`),
        testFolder.replace(/\\/g, `/`),
        `${Cli.options.cacheKey}`,
      );
      await CloudRunnerSystem.Run(`du -h ${__dirname}`);

      // Compare validity to original hash
      expect(fs.readFileSync(path.resolve(testFolder, 'test.txt'), { encoding: 'utf8' }).toString()).toContain(
        Cli.options.cacheKey,
      );
      fs.rmdirSync(testFolder, { recursive: true });
      fs.rmdirSync(cacheFolder, { recursive: true });

      GitHub.githubInputEnabled = true;
      delete Cli.options;
    }, 1000000);
  }
});
