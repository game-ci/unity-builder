import { customAlphabet } from 'nanoid';
import OrchestratorConstants from './orchestrator-constants';

class OrchestratorNamespace {
  static generateGuid(runNumber: string | number, platform: string) {
    const nanoid = customAlphabet(OrchestratorConstants.alphabet, 4);

    return `${runNumber}-${platform.toLowerCase().replace('standalone', '')}-${nanoid()}`;
  }
}
export default OrchestratorNamespace;
