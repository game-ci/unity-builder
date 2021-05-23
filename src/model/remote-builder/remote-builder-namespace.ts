import { customAlphabet } from 'nanoid';
import RemoteBuilderConstants from './remote-builder-constants';

class RemoteBuilderNamespace {
  static generateBuildName(runNumber, platform) {
    const nanoid = customAlphabet(RemoteBuilderConstants.alphabet, 4);
    return `${runNumber}-${platform.replace('Standalone', '').replace('standalone', '')}-${nanoid()}`;
  }
}
export default RemoteBuilderNamespace;
