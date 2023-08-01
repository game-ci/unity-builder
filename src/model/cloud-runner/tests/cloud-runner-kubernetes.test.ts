import BuildParameters from '../../build-parameters';
import { Cli } from '../../cli/cli';
import UnityVersioning from '../../unity-versioning';
import CloudRunner from '../cloud-runner';
import CloudRunnerOptions from '../options/cloud-runner-options';
import KubernetesLogService from '../providers/k8s/kubernetes-log-service';
import CloudRunnerLogger from '../services/core/cloud-runner-logger';
import setups from './cloud-runner-suite.test';
import { v4 as uuidv4 } from 'uuid';
import * as k8s from '@kubernetes/client-node';
import ImageTag from '../../image-tag';

async function CreateParameters(overrides: any) {
  if (overrides) {
    Cli.options = overrides;
  }

  return await BuildParameters.create();
}

describe('Cloud Runner Kubernetes', () => {
  it('Responds', () => {});
  setups();
  if (CloudRunnerOptions.cloudRunnerDebug) {
    it('Build create log service', async () => {
      const overrides = {
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.determineUnityVersion('test-project', UnityVersioning.read('test-project')),
        targetPlatform: 'StandaloneLinux64',
        cacheKey: `test-case-${uuidv4()}`,
        customJob: `
        - name: 'step 1'
          image: 'ubuntu'
          commands: 'curl http://$LOG_SERVICE_IP:80''`,
      };
      if (CloudRunnerOptions.providerStrategy !== `k8s`) {
        return;
      }
      const buildParameter = await CreateParameters(overrides);
      expect(buildParameter.projectPath).toEqual(overrides.projectPath);

      await CloudRunner.setup(buildParameter);
      const kubeConfig = new k8s.KubeConfig();
      kubeConfig.loadFromDefault();
      const kubeClient = kubeConfig.makeApiClient(k8s.CoreV1Api);
      const kubeClientApps = kubeConfig.makeApiClient(k8s.AppsV1Api);

      await KubernetesLogService.createLogDeployment('test', kubeClientApps, kubeClient);

      CloudRunnerLogger.log(`run 1 succeeded`);
    }, 1_000_000_000);
    it('curl log service', async () => {
      const overrides = {
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.read('test-project'),
        targetPlatform: 'StandaloneLinux64',
        cacheKey: `test-case-${uuidv4()}`,
        customJob: `
        - name: 'step 1'
          image: 'ubuntu'
          commands: |
            apt-get update
            apt-get install curl -y
            curl http://$LOG_SERVICE_IP:80`,
      };
      if (CloudRunnerOptions.providerStrategy !== `k8s`) {
        return;
      }
      const buildParameter = await CreateParameters(overrides);
      expect(buildParameter.projectPath).toEqual(overrides.projectPath);

      const baseImage = new ImageTag(buildParameter);
      const results = await CloudRunner.run(buildParameter, baseImage.toString());
      const buildSucceededString = 'Build succeeded';
      expect(results).toContain(buildSucceededString);

      CloudRunnerLogger.log(`run 1 succeeded`);
    }, 1_000_000_000);
  }
});
