// eslint-disable-next-line no-unused-vars
import { AWSCLICommands } from '../cloud-runner/cloud-runner-providers/aws/commands/aws-cli-commands';
// eslint-disable-next-line no-unused-vars
import { Caching } from '../cloud-runner/remote-client/caching';
// eslint-disable-next-line no-unused-vars
import { LFSHashing } from '../cloud-runner/remote-client/lfs-hashing';
// eslint-disable-next-line no-unused-vars
import { SetupCloudRunnerRepository } from '../cloud-runner/remote-client/setup-cloud-runner-repository';

const targets = new Array();
export function CliFunction(key: string, description: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    targets.push({
      target,
      propertyKey,
      descriptor,
      key,
      description,
    });
  };
}
export function GetCliFunctions(key) {
  const results = targets.find((x) => x.key === key);
  if (results === undefined || results.length === 0) {
    throw new Error(`no CLI mode found for ${key}`);
  }
  return results;
}
export function GetAllCliModes() {
  return targets.map((x) => {
    return {
      key: x.key,
      description: x.description,
    };
  });
}
