import { customAlphabet } from '../../../node_modules/nanoid';
import CloudRunnerConstants from './cloud-runner-constants.ts';

class CloudRunnerNamespace {
  static generateGuid(runNumber: string | number, platform: string) {
    const nanoid = customAlphabet(CloudRunnerConstants.alphabet, 4);

    return `${runNumber}-${platform.toLowerCase().replace('standalone', '')}-${nanoid()}`;
  }
}
export default CloudRunnerNamespace;
