import Input from '../../input';
import OrchestratorOptions from './orchestrator-options';

class OrchestratorOptionsReader {
  static GetProperties() {
    return [...Object.getOwnPropertyNames(Input), ...Object.getOwnPropertyNames(OrchestratorOptions)];
  }
}

export default OrchestratorOptionsReader;
