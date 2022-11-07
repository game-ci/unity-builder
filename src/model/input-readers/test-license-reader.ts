import path from 'path';
import fs from 'fs';
import YAML from 'yaml';
import CloudRunnerOptions from '../cloud-runner/cloud-runner-options';

export function ReadLicense() {
  if (CloudRunnerOptions.cloudRunnerCluster === 'local') {
    return '';
  }
  const pipelineFile = path.join(__dirname, `.github`, `workflows`, `cloud-runner-k8s-pipeline.yml`);

  return fs.existsSync(pipelineFile) ? YAML.parse(fs.readFileSync(pipelineFile, 'utf8')).env.UNITY_LICENSE : '';
}
