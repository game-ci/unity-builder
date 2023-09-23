import { RemoteClientLogger } from '../../remote-client/remote-client-logger';
import setups from '../cloud-runner-suite.test';
const md5 = require('md5');

describe('Cloud Runner Remote Client', () => {
  it('Responds', () => {});
  setups();
  it('Loghash digestion input matches output', async () => {
    const testLogStream = 'Test \n Log \n Stream';

    const splitLogStream = testLogStream.split('\n');
    RemoteClientLogger.HandleLogChunkLine(`LOGHASH: ${md5(testLogStream)}`);
    let completed = false;
    for (const element of splitLogStream) {
      completed = RemoteClientLogger.HandleLogChunkLine(element);
    }
    expect(completed).toBeTruthy();
  }, 1_000_000_000);
  // eslint-disable-next-line unicorn/consistent-function-scoping, no-unused-vars
  function CreateLogWatcher(callback: (finalMessage: string) => void) {
    return (message: string) => {
      callback(message);
    };
  }
});
