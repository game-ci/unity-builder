import { BuildParameters, ImageTag } from '..';
import CloudRunner from './cloud-runner';
import Input from '../input';
import { CloudRunnerStatics } from './cloud-runner-statics';
import { TaskParameterSerializer } from './services/task-parameter-serializer';

describe('Cloud Runner', () => {
  it('responds', () => {});
});
describe('Cloud Runner', () => {
  const testSecretName = 'testSecretName';
  const testSecretValue = 'testSecretValue';
  Input.cliOptions = {
    versioning: 'None',
    projectPath: 'test-project',
    customJob: `
    - name: 'step 1'
      image: 'alpine'
      commands: ['printenv']
      secrets:
        - name: '${testSecretName}'
          value: '${testSecretValue}'
    `,
  };
  Input.githubEnabled = false;
  it('All build parameters sent to cloud runner as env vars', async () => {
    if (Input.cloudRunnerTests) {
      const buildParameter = await BuildParameters.create();
      const baseImage = new ImageTag(buildParameter);
      const file = await CloudRunner.run(buildParameter, baseImage.toString());
      expect(file).toContain(JSON.stringify(buildParameter));
      expect(file).toContain(`${Input.ToEnvVarFormat(testSecretName)}=${testSecretValue}`);
      const environmentVariables = TaskParameterSerializer.readBuildEnvironmentVariables();
      const newLinePurgedFile = file
        .replace(/\s+/g, '')
        .replace(new RegExp(`\\[${CloudRunnerStatics.logPrefix}\\]`, 'g'), '');
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(environmentVariables, undefined, 4));
      for (const element of environmentVariables) {
        if (element.value !== undefined && typeof element.value !== 'function') {
          if (typeof element.value === `string`) {
            element.value = element.value.replace(/\s+/g, '');
          }
          expect(newLinePurgedFile).toContain(`${element.name}=${element.value}`);
        }
      }
    }
  }, 1000000);
});
