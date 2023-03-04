import * as core from '@actions/core';
import NotImplementedException from './error/not-implemented-exception';
import System from './system';
import Versioning from './versioning';
import { validVersionTagInputs, invalidVersionTagInputs } from './__data__/versions';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Versioning', () => {
  describe('strategies', () => {
    it('returns an object', () => {
      expect(typeof Versioning.strategies).toStrictEqual('object');
    });

    it('has items', () => {
      expect(Object.values(Versioning.strategies).length).toBeGreaterThan(2);
    });

    it('has an opt out option', () => {
      expect(Versioning.strategies).toHaveProperty('None');
    });

    it('has the semantic option', () => {
      expect(Versioning.strategies).toHaveProperty('Semantic');
    });

    it('has a strategy for tags', () => {
      expect(Versioning.strategies).toHaveProperty('Tag');
    });

    it('has an option that allows custom input', () => {
      expect(Versioning.strategies).toHaveProperty('Custom');
    });
  });

  describe('grepCompatibleInputVersionRegex', () => {
    // eslint-disable-next-line unicorn/consistent-function-scoping
    const matchInputUsingGrep = async (input: string) => {
      const output = await System.run('sh', undefined, {
        input: Buffer.from(`echo '${input}' | grep -E '${Versioning.grepCompatibleInputVersionRegex}'`),
        silent: true,
      });

      return output.trim();
    };

    it.concurrent.each(validVersionTagInputs)(`accepts valid tag input '%s'`, async (input) => {
      expect(await matchInputUsingGrep(input)).toStrictEqual(input);
    });

    it.concurrent.each(invalidVersionTagInputs)(`rejects non-version tag input '%s'`, async (input) => {
      await expect(async () => matchInputUsingGrep(input)).rejects.toThrowError(/^Failed to run/);
    });
  });

  describe('branch', () => {
    it('returns headRef when set', () => {
      const headReference = jest.spyOn(Versioning, 'headRef', 'get').mockReturnValue('feature-branch-1');

      expect(Versioning.branch).toStrictEqual('feature-branch-1');
      expect(headReference).toHaveBeenCalledTimes(1);
    });

    it('returns part of Ref when set', () => {
      jest.spyOn(Versioning, 'headRef', 'get').mockImplementation();
      const reference = jest.spyOn(Versioning, 'ref', 'get').mockReturnValue('refs/heads/feature-branch-2');

      expect(Versioning.branch).toStrictEqual('feature-branch-2');
      expect(reference).toHaveBeenCalledTimes(1);
    });

    it('prefers headRef over ref when set', () => {
      const headReference = jest.spyOn(Versioning, 'headRef', 'get').mockReturnValue('feature-branch-1');
      const reference = jest.spyOn(Versioning, 'ref', 'get').mockReturnValue('refs/heads/feature-2');

      expect(Versioning.branch).toStrictEqual('feature-branch-1');
      expect(headReference).toHaveBeenCalledTimes(1);
      expect(reference).toHaveBeenCalledTimes(0);
    });

    it('returns undefined when headRef and ref are not set', () => {
      const headReference = jest.spyOn(Versioning, 'headRef', 'get').mockImplementation();
      const reference = jest.spyOn(Versioning, 'ref', 'get').mockImplementation();

      expect(Versioning.branch).not.toBeDefined();

      expect(headReference).toHaveBeenCalledTimes(1);
      expect(reference).toHaveBeenCalledTimes(1);
    });
  });

  describe('headRef', () => {
    it('does not throw', () => {
      expect(() => Versioning.headRef).not.toThrow();
    });
  });

  describe('ref', () => {
    it('does not throw', () => {
      expect(() => Versioning.ref).not.toThrow();
    });
  });

  describe('logging git diff', () => {
    it('calls git diff', async () => {
      // allowDirtyBuild: true
      jest.spyOn(core, 'getInput').mockReturnValue('true');
      jest.spyOn(Versioning, 'isShallow').mockResolvedValue(true);
      jest.spyOn(Versioning, 'isDirty').mockResolvedValue(false);
      jest.spyOn(Versioning, 'fetch').mockImplementation();
      jest.spyOn(Versioning, 'hasAnyVersionTags').mockResolvedValue(true);
      jest
        .spyOn(Versioning, 'parseSemanticVersion')
        .mockResolvedValue({ match: '', tag: 'mocktag', commits: 'abcdef', hash: '75822BCAF' });
      const logDiffSpy = jest.spyOn(Versioning, 'logDiff');
      const gitSpy = jest.spyOn(System, 'run').mockImplementation();

      await Versioning.generateSemanticVersion();

      expect(logDiffSpy).toHaveBeenCalledTimes(1);
      expect(gitSpy).toHaveBeenCalledTimes(1);

      // Todo - this no longer works since typescript
      // const issuedCommand = System.run.mock.calls[0][2].input.toString();
      // expect(issuedCommand.indexOf('diff')).toBeGreaterThan(-1);
    });
  });

  describe('descriptionRegex1', () => {
    it('is a valid regex', () => {
      expect(Versioning.descriptionRegexes[0]).toBeInstanceOf(RegExp);
    });

    test.each(['v1.1-1-g12345678', 'v0.1-2-g12345678', 'v0.0-500-gA9B6C3D0-dirty'])(
      'is happy with valid %s',
      (description) => {
        expect(Versioning.descriptionRegexes[0].test(description)).toBeTruthy();
      },
    );

    test.each(['1.1-1-g12345678', '0.1-2-g12345678', '0.0-500-gA9B6C3D0-dirty'])(
      'accepts valid semantic versions without v-prefix %s',
      (description) => {
        expect(Versioning.descriptionRegexes[0].test(description)).toBeTruthy();
      },
    );

    test.each(['v0', 'v0.1', 'v0.1.2', 'v0.1-2', 'v0.1-2-g'])('does not like %s', (description) => {
      expect(Versioning.descriptionRegexes[0].test(description)).toBeFalsy();

      // Also, never expect without the v to work for any of these cases.
      expect(Versioning.descriptionRegexes[0].test(description?.slice(1))).toBeFalsy();
    });
  });

  describe('determineBuildVersion', () => {
    test.each(['somethingRandom'])('throws for invalid strategy %s', async (strategy) => {
      await expect(Versioning.determineBuildVersion(strategy, '')).rejects.toThrowErrorMatchingSnapshot();
    });

    describe('opt out strategy', () => {
      it("returns 'none'", async () => {
        await expect(Versioning.determineBuildVersion('None', 'v1.0')).resolves.toMatchInlineSnapshot(`"none"`);
      });
    });

    describe('custom strategy', () => {
      test.each(['v0.1', '1', 'CamelCase', 'dashed-version'])(
        'returns the inputVersion for %s',
        async (inputVersion) => {
          await expect(Versioning.determineBuildVersion('Custom', inputVersion)).resolves.toStrictEqual(inputVersion);
        },
      );
    });

    describe('semantic strategy', () => {
      it('refers to generateSemanticVersion', async () => {
        const generateSemanticVersion = jest.spyOn(Versioning, 'generateSemanticVersion').mockResolvedValue('1.3.37');

        await expect(Versioning.determineBuildVersion('Semantic', '')).resolves.toStrictEqual('1.3.37');
        expect(generateSemanticVersion).toHaveBeenCalledTimes(1);
      });
    });

    describe('tag strategy', () => {
      it('refers to generateTagVersion', async () => {
        const generateTagVersion = jest.spyOn(Versioning, 'generateTagVersion').mockResolvedValue('0.1');

        await expect(Versioning.determineBuildVersion('Tag', '')).resolves.toStrictEqual('0.1');
        expect(generateTagVersion).toHaveBeenCalledTimes(1);
      });
    });

    describe('not implemented strategy', () => {
      it('throws a not implemented exception', async () => {
        const strategy = 'Test';
        // @ts-ignore
        jest.spyOn(Versioning, 'strategies', 'get').mockReturnValue({ [strategy]: strategy });
        await expect(Versioning.determineBuildVersion(strategy, '')).rejects.toThrowError(NotImplementedException);
      });
    });
  });

  describe('generateTagVersion', () => {
    it('removes the v', async () => {
      jest.spyOn(Versioning, 'getTag').mockResolvedValue('v1.3.37');
      await expect(Versioning.generateTagVersion()).resolves.toStrictEqual('1.3.37');
    });
  });

  describe('parseSemanticVersion', () => {
    it('returns the named parts', async () => {
      jest.spyOn(Versioning, 'getVersionDescription').mockResolvedValue('v0.1-2-g12345678');

      await expect(Versioning.parseSemanticVersion()).resolves.toMatchObject({
        tag: '0.1',
        commits: '2',
        hash: '12345678',
      });
    });

    it('throws when no match could be made', async () => {
      jest.spyOn(Versioning, 'getVersionDescription').mockResolvedValue('no-match-can-be-made');

      await expect(Versioning.parseSemanticVersion()).toMatchObject({});
    });
  });

  describe('getVersionDescription', () => {
    it('returns the commands output', async () => {
      const runOutput = 'someValue';
      jest.spyOn(System, 'run').mockResolvedValue(runOutput);
      await expect(Versioning.getVersionDescription()).resolves.toStrictEqual(runOutput);
    });
  });

  describe('isShallow', () => {
    it('returns true when the repo is shallow', async () => {
      const runOutput = 'true\n';
      jest.spyOn(System, 'run').mockResolvedValue(runOutput);
      await expect(Versioning.isShallow()).resolves.toStrictEqual(true);
    });

    it('returns false when the repo is not shallow', async () => {
      const runOutput = 'false\n';
      jest.spyOn(System, 'run').mockResolvedValue(runOutput);
      await expect(Versioning.isShallow()).resolves.toStrictEqual(false);
    });
  });

  describe('fetch', () => {
    it('awaits the command', async () => {
      jest.spyOn(core, 'warning').mockImplementation(() => {});
      jest.spyOn(System, 'run').mockImplementation();
      await expect(Versioning.fetch()).resolves.not.toThrow();
    });

    it('falls back to the second strategy when the first fails', async () => {
      jest.spyOn(core, 'warning').mockImplementation(() => {});
      const gitFetch = jest.spyOn(System, 'run').mockImplementation();

      await expect(Versioning.fetch()).resolves.not.toThrow();
      expect(gitFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('generateSemanticVersion', () => {
    it('returns a proper version from description', async () => {
      jest.spyOn(System, 'run').mockImplementation();
      jest.spyOn(core, 'info').mockImplementation(() => {});
      jest.spyOn(Versioning, 'isDirty').mockResolvedValue(false);
      jest.spyOn(Versioning, 'hasAnyVersionTags').mockResolvedValue(true);
      jest.spyOn(Versioning, 'getTotalNumberOfCommits').mockResolvedValue(2);
      jest.spyOn(Versioning, 'parseSemanticVersion').mockResolvedValue({
        match: '0.1-2-g1b345678',
        tag: '0.1',
        commits: '2',
        hash: '1b345678',
      });

      await expect(Versioning.generateSemanticVersion()).resolves.toStrictEqual('0.1.2');
    });

    it('throws when dirty', async () => {
      jest.spyOn(System, 'run').mockImplementation();
      jest.spyOn(core, 'info').mockImplementation(() => {});
      jest.spyOn(Versioning, 'isDirty').mockResolvedValue(true);
      await expect(Versioning.generateSemanticVersion()).rejects.toThrowError();
    });

    it('falls back to commits only, when no tags are present', async () => {
      const commits = Math.round(Math.random() * 10);
      jest.spyOn(System, 'run').mockImplementation();
      jest.spyOn(core, 'info').mockImplementation(() => {});
      jest.spyOn(Versioning, 'isDirty').mockResolvedValue(false);
      jest.spyOn(Versioning, 'hasAnyVersionTags').mockResolvedValue(false);
      jest.spyOn(Versioning, 'getTotalNumberOfCommits').mockResolvedValue(commits);

      await expect(Versioning.generateSemanticVersion()).resolves.toStrictEqual(`0.0.${commits}`);
    });
  });

  describe('isDirty', () => {
    it('returns true when there are files listed', async () => {
      const runOutput = 'file.ext\nfile2.ext';
      jest.spyOn(System, 'run').mockResolvedValue(runOutput);
      await expect(Versioning.isDirty()).resolves.toStrictEqual(true);
    });

    it('returns false when there is no output', async () => {
      const runOutput = '';
      jest.spyOn(System, 'run').mockResolvedValue(runOutput);
      await expect(Versioning.isDirty()).resolves.toStrictEqual(false);
    });
  });

  describe('getTag', () => {
    it('returns the commands output', async () => {
      const runOutput = 'v1.0';
      jest.spyOn(System, 'run').mockResolvedValue(runOutput);
      await expect(Versioning.getTag()).resolves.toStrictEqual(runOutput);
    });
  });

  describe('hasAnyVersionTags', () => {
    it('returns false when the command returns 0', async () => {
      const runOutput = '0';
      jest.spyOn(System, 'run').mockResolvedValue(runOutput);
      await expect(Versioning.hasAnyVersionTags()).resolves.toStrictEqual(false);
    });

    it('returns true when the command returns >= 0', async () => {
      const runOutput = '9';
      jest.spyOn(System, 'run').mockResolvedValue(runOutput);
      await expect(Versioning.hasAnyVersionTags()).resolves.toStrictEqual(true);
    });
  });

  describe('getTotalNumberOfCommits', () => {
    it('returns a number from the command', async () => {
      jest.spyOn(System, 'run').mockResolvedValue('9');
      await expect(Versioning.getTotalNumberOfCommits()).resolves.toStrictEqual(9);
    });
  });
});
