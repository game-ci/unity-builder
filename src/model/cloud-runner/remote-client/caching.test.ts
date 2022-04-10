import fs from 'fs';
import path from 'path';
import BuildParameters from '../../build-parameters';
import { Cli } from '../../cli/cli';
import Input from '../../input';
import UnityVersioning from '../../unity-versioning';
import CloudRunner from '../cloud-runner';
import { CloudRunnerSystem } from '../services/cloud-runner-system';
import { Caching } from './caching';

function guid() {
  return Math.trunc((1 + Math.random()) * 0x10000)
    .toString(16)
    .slice(1);
}
function guidGenerator() {
  return `${guid() + guid()}-${guid()}-${guid()}-${guid()}-${guid()}${guid()}${guid()}`;
}
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
        cacheKey: `test-case-${guidGenerator()}`,
      };
      Input.githubInputEnabled = false;
      const buildParameter = await BuildParameters.create();
      CloudRunner.buildParameters = buildParameter;

      // create test folder
      const testFolder = path.resolve(__dirname, Cli.options.cacheKey);
      fs.mkdirSync(testFolder);

      // crate cache folder
      const cacheFolder = path.resolve(__dirname, `cache-${Cli.options.cacheKey}`);
      fs.mkdirSync(cacheFolder);

      // add test has file to test folders
      fs.writeFileSync(path.resolve(testFolder, 'test.txt'), Cli.options.cacheKey);
      await Caching.PushToCache(cacheFolder, testFolder, `${Cli.options.cacheKey}`);

      // delete test folder
      fs.rmdirSync(testFolder, { recursive: true });
      await Caching.PullFromCache(
        cacheFolder.replace(/\\/g, `/`),
        testFolder.replace(/\\/g, `/`),
        `${Cli.options.cacheKey}`,
      );
      await CloudRunnerSystem.Run(`du -h ${__dirname}`);
      await CloudRunnerSystem.Run(`tree ${testFolder}`);
      await CloudRunnerSystem.Run(`tree ${cacheFolder}`);

      // compare validity to original hash
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
