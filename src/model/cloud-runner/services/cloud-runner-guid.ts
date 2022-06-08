import { nanoid } from '../../../dependencies.ts';
import CloudRunnerConstants from './cloud-runner-constants.ts';

class CloudRunnerNamespace {
  static generateGuid(runNumber: string | number, platform: string) {
    const nanoid = nanoid.customAlphabet(CloudRunnerConstants.alphabet, 4);

    return `${runNumber}-${platform.toLowerCase().replace('standalone', '')}-${nanoid()}`;
  }
}
export default CloudRunnerNamespace;
