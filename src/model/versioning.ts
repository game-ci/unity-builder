import NotImplementedException from './error/not-implemented-exception.ts';
import ValidationError from './error/validation-error.ts';
import Input from './input.ts';
import System from './system.ts';

export default class Versioning {
  static get projectPath() {
    return Input.projectPath;
  }

  static get strategies() {
    return { None: 'None', Semantic: 'Semantic', Tag: 'Tag', Custom: 'Custom' };
  }

  static get grepCompatibleInputVersionRegex() {
    return '^v?([0-9]+\\.)*[0-9]+.*';
  }

  /**
   * Get the branch name of the (related) branch
   */
  static async getCurrentBranch() {
    // GitHub pull request, GitHub non pull request
    let branchName = this.headRef || this.ref?.slice(11);

    // Local
    if (!branchName) {
      const { status, output } = await System.shellRun('git branch --show-current');
      if (!status.success) throw new Error('did not expect "git branch --show-current"');
      branchName = output;
    }

    return branchName;
  }

  /**
   * For pull requests we can reliably use GITHUB_HEAD_REF
   */
  static get headRef() {
    return Deno.env.get('GITHUB_HEAD_REF');
  }

  /**
   * For branches GITHUB_REF will have format `refs/heads/feature-branch-1`
   */
  static get ref() {
    return Deno.env.get('GITHUB_REF');
  }

  /**
   * The commit SHA that triggered the workflow run.
   */
  static get sha() {
    return Deno.env.get('GITHUB_SHA');
  }

  /**
   * Maximum number of lines to print when logging the git diff
   */
  static get maxDiffLines() {
    return 60;
  }

  /**
   * Regex to parse version description into separate fields
   */
  static get descriptionRegex1() {
    return /^v?([\d.]+)-(\d+)-g(\w+)-?(\w+)*/g;
  }

  static get descriptionRegex2() {
    return /^v?([\d.]+-\w+)-(\d+)-g(\w+)-?(\w+)*/g;
  }

  static get descriptionRegex3() {
    return /^v?([\d.]+-\w+\.\d+)-(\d+)-g(\w+)-?(\w+)*/g;
  }

  static async determineBuildVersion(strategy: string, inputVersion: string, allowDirtyBuild: boolean) {
    // Validate input
    if (!Object.hasOwnProperty.call(this.strategies, strategy)) {
      throw new ValidationError(`Versioning strategy should be one of ${Object.values(this.strategies).join(', ')}.`);
    }

    log.info('Versioning strategy:', strategy);

    let version;
    switch (strategy) {
      case this.strategies.None:
        version = 'none';
        break;
      case this.strategies.Custom:
        version = inputVersion;
        break;
      case this.strategies.Semantic:
        version = await this.generateSemanticVersion(allowDirtyBuild);
        break;
      case this.strategies.Tag:
        version = await this.generateTagVersion();
        break;
      default:
        throw new NotImplementedException(`Strategy ${strategy} is not implemented.`);
    }

    log.info('Version of this build:', version);

    return version;
  }

  /**
   * Log up to maxDiffLines of the git diff.
   */
  static async logDiff() {
    const diffCommand = `git --no-pager diff | head -n ${this.maxDiffLines.toString()}`;
    const result = await System.shellRun(diffCommand);

    log.debug(result.output);
  }

  /**
   * Automatically generates a version based on SemVer out of the box.
   *
   * The version works as follows: `<major>.<minor>.<patch>` for example `0.1.2`.
   *
   * The latest tag dictates `<major>.<minor>`
   * The number of commits since that tag dictates`<patch>`.
   *
   * @See: https://semver.org/
   */
  static async generateSemanticVersion(allowDirtyBuild) {
    if (await this.isShallow()) {
      await this.fetch();
    }

    if ((await this.isDirty()) && !allowDirtyBuild) {
      await Versioning.logDiff();
      throw new Error('Branch is dirty. Refusing to base semantic version on uncommitted changes');
    }

    if (!(await this.hasAnyVersionTags())) {
      const version = `0.0.${await this.getTotalNumberOfCommits()}`;
      log.info(`Generated version ${version} (no version tags found).`);

      return version;
    }

    const versionDescriptor = await this.parseSemanticVersion();
    if (versionDescriptor) {
      const { tag, commits, hash } = versionDescriptor;

      // Ensure 3 digits (commits should always be patch level)
      const [major, minor, patch] = `${tag}.${commits}`.split('.');
      const threeDigitVersion = /^\d+$/.test(patch) ? `${major}.${minor}.${patch}` : `${major}.0.${minor}`;

      const branch = await this.getCurrentBranch();
      log.info(`Found semantic version ${threeDigitVersion} for ${branch}@${hash}`);

      return `${threeDigitVersion}`;
    }

    const version = `0.0.${await this.getTotalNumberOfCommits()}`;
    log.info(`Generated version ${version} (semantic version couldn't be determined).`);

    return version;
  }

  /**
   * Generate the proper version for unity based on an existing tag.
   */
  static async generateTagVersion() {
    let tag = await this.getTag();

    if (tag.charAt(0) === 'v') {
      tag = tag.slice(1);
    }

    return tag;
  }

  /**
   * Parses the versionDescription into their named parts.
   */
  static async parseSemanticVersion() {
    const description = await this.getVersionDescription();

    try {
      const [match, tag, commits, hash] = this.descriptionRegex1.exec(description) as RegExpExecArray;

      return {
        match,
        tag,
        commits,
        hash,
      };
    } catch {
      try {
        const [match, tag, commits, hash] = this.descriptionRegex2.exec(description) as RegExpExecArray;

        return {
          match,
          tag,
          commits,
          hash,
        };
      } catch {
        try {
          const [match, tag, commits, hash] = this.descriptionRegex3.exec(description) as RegExpExecArray;

          return {
            match,
            tag,
            commits,
            hash,
          };
        } catch {
          log.warning(`Failed to parse git describe output or version can not be determined through "${description}".`);

          return false;
        }
      }
    }
  }

  /**
   * Returns whether the repository is shallow.
   */
  static async isShallow() {
    const output = await this.git(['rev-parse', '--is-shallow-repository']);

    return output !== 'false';
  }

  /**
   * Retrieves refs from the configured remote.
   *
   * Fetch unshallow for incomplete repository, but fall back to normal fetch.
   *
   * Note: `--all` should not be used, and would break fetching for push event.
   */
  static async fetch() {
    try {
      await this.git(['fetch', '--unshallow']);
    } catch {
      log.warning(`fetch --unshallow did not work, falling back to regular fetch`);
      await this.git(['fetch']);
    }
  }

  /**
   * Retrieves information about the branch.
   *
   * Format: `v0.12-24-gd2198ab`
   *
   * In this format v0.12 is the latest tag, 24 are the number of commits since, and gd2198ab
   * identifies the current commit.
   */
  static async getVersionDescription() {
    return this.git(['describe', '--long', '--tags', '--always', this.sha]);
  }

  /**
   * Returns whether there are uncommitted changes that are not ignored.
   */
  static async isDirty() {
    const output = await this.git(['status', '--porcelain']);
    const isDirty = output !== '';

    if (isDirty) {
      log.warning(
        `Changes were made to the following files and folders:\n\n  A = addition, M = modification, D = deletion\n\n`,
        output,
      );
    }

    return isDirty;
  }

  /**
   * Get the tag if there is one pointing at HEAD
   */
  static async getTag() {
    return await this.git(['tag', '--points-at', 'HEAD']);
  }

  /**
   * Whether the current tree has any version tags yet.
   *
   * Note: Currently this is run in all OSes, so the syntax must be cross-platform.
   */
  static async hasAnyVersionTags() {
    const command = `git tag --list --merged HEAD | grep -E '${this.grepCompatibleInputVersionRegex}' | wc -l`;

    // Todo - make sure this cwd is actually passed in somehow
    const result = await System.shellRun(command, { cwd: this.projectPath, silent: false });

    log.debug(result);

    const { output: numberOfTagsAsString } = result;
    const numberOfTags = Number.parseInt(numberOfTagsAsString, 10);

    log.debug('numberOfTags', numberOfTags);

    return numberOfTags !== 0;
  }

  /**
   * Get the total number of commits on head.
   *
   * Note: HEAD should not be used, as it may be detached, resulting in an additional count.
   */
  static async getTotalNumberOfCommits() {
    const numberOfCommitsAsString = await this.git(['rev-list', '--count', this.sha]);

    return Number.parseInt(numberOfCommitsAsString, 10);
  }

  /**
   * Run git in the specified project path
   */
  static async git(arguments_, options = {}) {
    return System.run('git', arguments_, { cwd: this.projectPath, ...options });
  }
}
