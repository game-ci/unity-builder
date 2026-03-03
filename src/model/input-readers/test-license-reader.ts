import path from 'node:path';
import fs from 'node:fs';
import YAML from 'yaml';
import OrchestratorOptions from '../orchestrator/options/orchestrator-options';

export function ReadLicense(): string {
  if (OrchestratorOptions.providerStrategy === 'local') {
    return '';
  }
  const pipelineFile = path.join(__dirname, `.github`, `workflows`, `orchestrator-k8s-pipeline.yml`);

  return fs.existsSync(pipelineFile) ? YAML.parse(fs.readFileSync(pipelineFile, 'utf8')).env.UNITY_LICENSE : '';
}
