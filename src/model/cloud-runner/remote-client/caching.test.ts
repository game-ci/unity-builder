import fs from 'fs';
import path from 'path';
import BuildParameters from '../../build-parameters';
import { Cli } from '../../cli/cli';
import Input from '../../input';
import UnityVersioning from '../../unity-versioning';
import CloudRunner from '../cloud-runner';
import { CloudRunnerSystem } from '../services/cloud-runner-system';
import { Caching } from './caching';
import { v4 as uuidv4 } from 'uuid';

describe('Cloud Runner Caching', () => {
  it('responds', () => {});
});
describe('Cloud Runner Caching', () => {
  if (process.platform === 'linux') {
    it('Simple caching works', async () => {
      Cli.options = {
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.read('test-project'),
        targetPlatform: 'StandaloneLinux64',
        cacheKey: `test-case-${uuidv4()}`,
      };
      Input.githubInputEnabled = false;
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
      await CloudRunnerSystem.Run(`tree ${testFolder}`);
      await CloudRunnerSystem.Run(`tree ${cacheFolder}`);

      // Compare validity to original hash
      expect(fs.readFileSync(path.resolve(testFolder, 'test.txt'), { encoding: 'utf8' }).toString()).toContain(
        Cli.options.cacheKey,
      );
      fs.rmdirSync(testFolder, { recursive: true });
      fs.rmdirSync(cacheFolder, { recursive: true });

      Input.githubInputEnabled = true;
      delete Cli.options;
    }, 1000000);
  }
});
