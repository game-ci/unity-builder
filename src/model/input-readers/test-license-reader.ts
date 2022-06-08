import { fsSync as fs, path, YAML, __dirname } from '../../dependencies.ts';
import Input from '../input.ts';

export function ReadLicense() {
  if (Input.cloudRunnerCluster === 'local') {
    return '';
  }
  const pipelineFile = path.join(__dirname, `.github`, `workflows`, `cloud-runner-k8s-pipeline.yml`);

  return fs.existsSync(pipelineFile) ? YAML.parse(fs.readFileSync(pipelineFile, 'utf8')).env.UNITY_LICENSE : '';
}
