import path from 'node:path';
import fs from 'node:fs';
import YAML from 'yaml';
import CloudRunnerOptions from '../cloud-runner/options/cloud-runner-options';

export function ReadLicense(): string {
  if (CloudRunnerOptions.providerStrategy === 'local') {
    return '';
  }
  const pipelineFile = path.join(__dirname, `.github`, `workflows`, `cloud-runner-k8s-pipeline.yml`);

  return fs.existsSync(pipelineFile) ? YAML.parse(fs.readFileSync(pipelineFile, 'utf8')).env.UNITY_LICENSE : '';
}
