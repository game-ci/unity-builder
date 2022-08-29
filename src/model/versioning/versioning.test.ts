import { core } from '../../dependencies.ts';
import NotImplementedException from '../error/not-implemented-exception.ts';
import System from '../system/system.ts';
import BuildVersionGenerator from '../../middleware/build-versioning/build-version-generator.ts';
import { validVersionTagInputs, invalidVersionTagInputs } from '../__data__/versions.ts';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Versioning', () => {
  describe('strategies', () => {
    it('returns an object', () => {
      expect(typeof BuildVersionGenerator.strategies).toStrictEqual('object');
    });

    it('has items', () => {
      expect(Object.values(BuildVersionGenerator.strategies).length).toBeGreaterThan(2);
    });

    it('has an opt out option', () => {
      expect(BuildVersionGenerator.strategies).toHaveProperty('None');
    });

    it('has the semantic option', () => {
      expect(BuildVersionGenerator.strategies).toHaveProperty('Semantic');
    });

    it('has a strategy for tags', () => {
      expect(BuildVersionGenerator.strategies).toHaveProperty('Tag');
    });

    it('has an option that allows custom input', () => {
      expect(BuildVersionGenerator.strategies).toHaveProperty('Custom');
    });
  });

  describe('grepCompatibleInputVersionRegex', () => {
    // eslint-disable-next-line unicorn/consistent-function-scoping
    const matchInputUsingGrep = async (input) => {
      const output = await System.run('sh', undefined, {
        input: Buffer.from(`echo '${input}' | grep -E '${BuildVersionGenerator.grepCompatibleInputVersionRegex}'`),
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
    it('returns headRef when set', async () => {
      const headReference = jest.spyOn(BuildVersionGenerator, 'headRef', 'get').mockReturnValue('feature-branch-1');

      await expect(BuildVersionGenerator.getCurrentBranch).resolves.toStrictEqual('feature-branch-1');
      expect(headReference).toHaveBeenCalledTimes(1);
    });

    it('returns part of Ref when set', () => {
      jest.spyOn(BuildVersionGenerator, 'headRef', 'get').mockImplementation();
      const reference = jest.spyOn(BuildVersionGenerator, 'ref', 'get').mockReturnValue('refs/heads/feature-branch-2');

      await expect(BuildVersionGenerator.getCurrentBranch).resolves.toStrictEqual('feature-branch-2');
      expect(reference).toHaveBeenCalledTimes(2);
    });

    it('prefers headRef over ref when set', () => {
      const headReference = jest.spyOn(BuildVersionGenerator, 'headRef', 'get').mockReturnValue('feature-branch-1');
      const reference = jest.spyOn(BuildVersionGenerator, 'ref', 'get').mockReturnValue('refs/heads/feature-2');

      await expect(BuildVersionGenerator.getCurrentBranch).resolves.toStrictEqual('feature-branch-1');
      expect(headReference).toHaveBeenCalledTimes(1);
      expect(reference).toHaveBeenCalledTimes(0);
    });

    it('returns undefined when headRef and ref are not set', async () => {
      const headReference = jest.spyOn(BuildVersionGenerator, 'headRef', 'get').mockImplementation();
      const reference = jest.spyOn(BuildVersionGenerator, 'ref', 'get').mockImplementation();

      await expect(BuildVersionGenerator.getCurrentBranch).resolves.not.toBeDefined();

      expect(headReference).toHaveBeenCalledTimes(1);
      expect(reference).toHaveBeenCalledTimes(1);
    });
  });

  describe('headRef', () => {
    it('does not throw', () => {
      expect(() => BuildVersionGenerator.headRef).not.toThrow();
    });
  });

  describe('ref', () => {
    it('does not throw', () => {
      expect(() => BuildVersionGenerator.ref).not.toThrow();
    });
  });

  describe('isDirtyAllowed', () => {
    it('does not throw', () => {
      expect(() => BuildVersionGenerator.isDirtyAllowed).not.toThrow();
    });

    it('returns false by default', () => {
      expect(BuildVersionGenerator.isDirtyAllowed).toStrictEqual(false);
    });
  });

  describe('logging git diff', () => {
    it('calls git diff', async () => {
      // allowDirtyBuild: true
      jest.spyOn(core, 'getInput').mockReturnValue('true');
      jest.spyOn(BuildVersionGenerator, 'isShallow').mockResolvedValue(true);
      jest.spyOn(BuildVersionGenerator, 'isDirty').mockResolvedValue(false);
      jest.spyOn(BuildVersionGenerator, 'fetch').mockImplementation();
      jest.spyOn(BuildVersionGenerator, 'hasAnyVersionTags').mockResolvedValue(true);
      jest
        .spyOn(BuildVersionGenerator, 'parseSemanticVersion')
        .mockResolvedValue({ match: '', tag: 'mocktag', commits: 'abcdef', hash: '75822BCAF' });
      const logDiffSpy = jest.spyOn(BuildVersionGenerator, 'logDiff');
      const gitSpy = jest.spyOn(System, 'run').mockImplementation();

      await BuildVersionGenerator.generateSemanticVersion();

      expect(logDiffSpy).toHaveBeenCalledTimes(1);
      expect(gitSpy).toHaveBeenCalledTimes(1);

      // Todo - this no longer works since typescript
      // const issuedCommand = System.run.mock.calls[0][2].input.toString();
      // expect(issuedCommand.indexOf('diff')).toBeGreaterThan(-1);
    });
  });

  describe('descriptionRegex1', () => {
    it('is a valid regex', () => {
      expect(BuildVersionGenerator.descriptionRegex1).toBeInstanceOf(RegExp);
    });

    test.each(['v1.1-1-g12345678', 'v0.1-2-g12345678', 'v0.0-500-gA9B6C3D0-dirty'])(
      'is happy with valid %s',
      (description) => {
        expect(BuildVersionGenerator.descriptionRegex1.test(description)).toBeTruthy();
      },
    );

    test.each(['1.1-1-g12345678', '0.1-2-g12345678', '0.0-500-gA9B6C3D0-dirty'])(
      'accepts valid semantic versions without v-prefix %s',
      (description) => {
        expect(BuildVersionGenerator.descriptionRegex1.test(description)).toBeTruthy();
      },
    );

    test.each(['v0', 'v0.1', 'v0.1.2', 'v0.1-2', 'v0.1-2-g'])('does not like %s', (description) => {
      expect(BuildVersionGenerator.descriptionRegex1.test(description)).toBeFalsy();

      // Also, never expect without the v to work for any of these cases.
      expect(BuildVersionGenerator.descriptionRegex1.test(description?.slice(1))).toBeFalsy();
    });
  });

  describe('determineBuildVersion', () => {
    test.each(['somethingRandom'])('throws for invalid strategy %s', async (strategy) => {
      await expect(BuildVersionGenerator.determineBuildVersion(strategy, '')).rejects.toThrowErrorMatchingSnapshot();
    });

    describe('opt out strategy', () => {
      it("returns 'none'", async () => {
        await expect(BuildVersionGenerator.determineBuildVersion('None', 'v1.0')).resolves.toMatchInlineSnapshot(`"none"`);
      });
    });

    describe('custom strategy', () => {
      test.each(['v0.1', '1', 'CamelCase', 'dashed-version'])(
        'returns the inputVersion for %s',
        async (inputVersion) => {
          await expect(BuildVersionGenerator.determineBuildVersion('Custom', inputVersion)).resolves.toStrictEqual(inputVersion);
        },
      );
    });

    describe('semantic strategy', () => {
      it('refers to generateSemanticVersion', async () => {
        const generateSemanticVersion = jest.spyOn(BuildVersionGenerator, 'generateSemanticVersion').mockResolvedValue('1.3.37');

        await expect(BuildVersionGenerator.determineBuildVersion('Semantic', '')).resolves.toStrictEqual('1.3.37');
        expect(generateSemanticVersion).toHaveBeenCalledTimes(1);
      });
    });

    describe('tag strategy', () => {
      it('refers to generateTagVersion', async () => {
        const generateTagVersion = jest.spyOn(BuildVersionGenerator, 'generateTagVersion').mockResolvedValue('0.1');

        await expect(BuildVersionGenerator.determineBuildVersion('Tag', '')).resolves.toStrictEqual('0.1');
        expect(generateTagVersion).toHaveBeenCalledTimes(1);
      });
    });

    describe('not implemented strategy', () => {
      it('throws a not implemented exception', async () => {
        const strategy = 'Test';
        // @ts-ignore
        jest.spyOn(BuildVersionGenerator, 'strategies', 'get').mockReturnValue({ [strategy]: strategy });
        await expect(BuildVersionGenerator.determineBuildVersion(strategy, '')).rejects.toThrowError(NotImplementedException);
      });
    });
  });

  describe('generateTagVersion', () => {
    it('removes the v', async () => {
      jest.spyOn(BuildVersionGenerator, 'getTag').mockResolvedValue('v1.3.37');
      await expect(BuildVersionGenerator.generateTagVersion()).resolves.toStrictEqual('1.3.37');
    });
  });

  describe('parseSemanticVersion', () => {
    it('returns the named parts', async () => {
      jest.spyOn(BuildVersionGenerator, 'getVersionDescription').mockResolvedValue('v0.1-2-g12345678');

      await expect(BuildVersionGenerator.parseSemanticVersion()).resolves.toMatchObject({
        tag: '0.1',
        commits: '2',
        hash: '12345678',
      });
    });

    it('throws when no match could be made', async () => {
      jest.spyOn(BuildVersionGenerator, 'getVersionDescription').mockResolvedValue('no-match-can-be-made');

      await expect(BuildVersionGenerator.parseSemanticVersion()).toMatchObject({});
    });
  });

  describe('getVersionDescription', () => {
    it('returns the commands output', async () => {
      const runOutput = 'someValue';
      jest.spyOn(System, 'run').mockResolvedValue(runOutput);
      await expect(BuildVersionGenerator.getVersionDescription()).resolves.toStrictEqual(runOutput);
    });
  });

  describe('isShallow', () => {
    it('returns true when the repo is shallow', async () => {
      const runOutput = 'true\n';
      jest.spyOn(System, 'run').mockResolvedValue(runOutput);
      await expect(BuildVersionGenerator.isShallow()).resolves.toStrictEqual(true);
    });

    it('returns false when the repo is not shallow', async () => {
      const runOutput = 'false\n';
      jest.spyOn(System, 'run').mockResolvedValue(runOutput);
      await expect(BuildVersionGenerator.isShallow()).resolves.toStrictEqual(false);
    });
  });

  describe('fetch', () => {
    it('awaits the command', async () => {
      jest.spyOn(core, 'warning').mockImplementation(() => {});
      jest.spyOn(System, 'run').mockImplementation();
      await expect(BuildVersionGenerator.fetch()).resolves.not.toThrow();
    });

    it('falls back to the second strategy when the first fails', async () => {
      jest.spyOn(core, 'warning').mockImplementation(() => {});
      const gitFetch = jest.spyOn(System, 'run').mockImplementation();

      await expect(BuildVersionGenerator.fetch()).resolves.not.toThrow();
      expect(gitFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('generateSemanticVersion', () => {
    it('returns a proper version from description', async () => {
      jest.spyOn(System, 'run').mockImplementation();
      jest.spyOn(core, 'info').mockImplementation(() => {});
      jest.spyOn(BuildVersionGenerator, 'isDirty').mockResolvedValue(false);
      jest.spyOn(BuildVersionGenerator, 'hasAnyVersionTags').mockResolvedValue(true);
      jest.spyOn(BuildVersionGenerator, 'getTotalNumberOfCommits').mockResolvedValue(2);
      jest.spyOn(BuildVersionGenerator, 'parseSemanticVersion').mockResolvedValue({
        match: '0.1-2-g1b345678',
        tag: '0.1',
        commits: '2',
        hash: '1b345678',
      });

      await expect(BuildVersionGenerator.generateSemanticVersion()).resolves.toStrictEqual('0.1.2');
    });

    it('throws when dirty', async () => {
      jest.spyOn(System, 'run').mockImplementation();
      jest.spyOn(core, 'info').mockImplementation(() => {});
      jest.spyOn(BuildVersionGenerator, 'isDirty').mockResolvedValue(true);
      await expect(BuildVersionGenerator.generateSemanticVersion()).rejects.toThrowError();
    });

    it('falls back to commits only, when no tags are present', async () => {
      const commits = Math.round(Math.random() * 10);
      jest.spyOn(System, 'run').mockImplementation();
      jest.spyOn(core, 'info').mockImplementation(() => {});
      jest.spyOn(BuildVersionGenerator, 'isDirty').mockResolvedValue(false);
      jest.spyOn(BuildVersionGenerator, 'hasAnyVersionTags').mockResolvedValue(false);
      jest.spyOn(BuildVersionGenerator, 'getTotalNumberOfCommits').mockResolvedValue(commits);

      await expect(BuildVersionGenerator.generateSemanticVersion()).resolves.toStrictEqual(`0.0.${commits}`);
    });
  });

  describe('isDirty', () => {
    it('returns true when there are files listed', async () => {
      const runOutput = 'file.ext\nfile2.ext';
      jest.spyOn(System, 'run').mockResolvedValue(runOutput);
      await expect(BuildVersionGenerator.isDirty()).resolves.toStrictEqual(true);
    });

    it('returns false when there is no output', async () => {
      const runOutput = '';
      jest.spyOn(System, 'run').mockResolvedValue(runOutput);
      await expect(BuildVersionGenerator.isDirty()).resolves.toStrictEqual(false);
    });
  });

  describe('getTag', () => {
    it('returns the commands output', async () => {
      const runOutput = 'v1.0';
      jest.spyOn(System, 'run').mockResolvedValue(runOutput);
      await expect(BuildVersionGenerator.getTag()).resolves.toStrictEqual(runOutput);
    });
  });

  describe('hasAnyVersionTags', () => {
    it('returns false when the command returns 0', async () => {
      const runOutput = '0';
      jest.spyOn(System, 'run').mockResolvedValue(runOutput);
      await expect(BuildVersionGenerator.hasAnyVersionTags()).resolves.toStrictEqual(false);
    });

    it('returns true when the command returns >= 0', async () => {
      const runOutput = '9';
      jest.spyOn(System, 'run').mockResolvedValue(runOutput);
      await expect(BuildVersionGenerator.hasAnyVersionTags()).resolves.toStrictEqual(true);
    });
  });

  describe('getTotalNumberOfCommits', () => {
    it('returns a number from the command', async () => {
      jest.spyOn(System, 'run').mockResolvedValue('9');
      await expect(BuildVersionGenerator.getTotalNumberOfCommits()).resolves.toStrictEqual(9);
    });
  });
});
