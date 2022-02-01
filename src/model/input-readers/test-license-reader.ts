import path from 'path';
import fs from 'fs';
import YAML from 'yaml';

export function ReadLicense() {
  const pipelineFile = path.join(__dirname, `.github`, `workflows`, `cloud-runner-k8s-pipeline.yml`);
  return fs.existsSync(pipelineFile) ? YAML.parse(fs.readFileSync(pipelineFile, 'utf8')).env.UNITY_LICENSE : '';
}
