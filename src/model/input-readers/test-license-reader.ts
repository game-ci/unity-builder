import * as path from 'https://deno.land/std@0.141.0/path/mod.ts';
import fs from '../../../node_modules/fs';
import YAML from '../../../node_modules/yaml';
import Input from '../input.ts';

export function ReadLicense() {
  if (Input.cloudRunnerCluster === 'local') {
    return '';
  }
  const pipelineFile = path.join(__dirname, `.github`, `workflows`, `cloud-runner-k8s-pipeline.yml`);

  return fs.existsSync(pipelineFile) ? YAML.parse(fs.readFileSync(pipelineFile, 'utf8')).env.UNITY_LICENSE : '';
}
