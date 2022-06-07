import * as path from 'https://deno.land/std@0.141.0/path/mod.ts';
import fs from '../../../node_modules/fs';
import Action from './action.ts';

describe('Action', () => {
  describe('compatibility check', () => {
    it('throws for anything other than linux, windows, or mac', () => {
      switch (process.platform) {
        case 'linux':
        case 'win32':
        case 'darwin':
          expect(() => Action.checkCompatibility()).not.toThrow();
          break;
        default:
          expect(() => Action.checkCompatibility()).toThrow();
      }
    });
  });

  it('returns the root folder of the action', () => {
    const { rootFolder, canonicalName } = Action;

    expect(path.basename(rootFolder)).toStrictEqual(canonicalName);
    expect(fs.existsSync(rootFolder)).toStrictEqual(true);
  });

  it('returns the action folder', () => {
    const { actionFolder } = Action;

    expect(path.basename(actionFolder)).toStrictEqual('dist');
    expect(fs.existsSync(actionFolder)).toStrictEqual(true);
  });
});
