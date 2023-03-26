import Input from '../../input';
import CloudRunnerOptions from './cloud-runner-options';

class CloudRunnerOptionsReader {
  static GetProperties() {
    return [...Object.getOwnPropertyNames(Input), ...Object.getOwnPropertyNames(CloudRunnerOptions)];
  }
}

export default CloudRunnerOptionsReader;
