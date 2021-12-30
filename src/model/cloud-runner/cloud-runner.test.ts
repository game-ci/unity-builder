import { BuildParameters, ImageTag } from '..';
import CloudRunner from './cloud-runner';
import Input from '../input';
import fs from 'fs';
import { CloudRunnerState } from './state/cloud-runner-state';
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
      buildParameter.logToFile = true;
      const baseImage = new ImageTag(buildParameter);
      await CloudRunner.run(buildParameter, baseImage.toString());
      const testOutput = `${CloudRunnerState.buildParams.buildGuid}-outputfile.txt`;
      expect(fs.existsSync(testOutput)).toBeTruthy();
      const file = fs.readFileSync(testOutput, 'utf-8').toString();
      expect(file).toContain(JSON.stringify(buildParameter));
      expect(file).toContain(`${Input.ToEnvVarFormat(testSecretName)}=${testSecretValue}`);
      const environmentVariables = TaskParameterSerializer.readBuildEnvironmentVariables();
      const newLinePurgedFile = file
        .replace(/\s+/g, '')
        .replace(new RegExp(`\\[${CloudRunnerStatics.logPrefix}\\]`, 'g'), '');
      for (const element of environmentVariables) {
        if (element.value !== undefined && typeof element.value !== 'function') {
          const newLinePurgedValue = element.value.toString().replace(/\s+/g, '');
          expect(newLinePurgedFile).toContain(`${element.name}=${newLinePurgedValue}`);
        }
      }
    }
  }, 1000000);
});
