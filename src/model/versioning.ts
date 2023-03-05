import * as core from '@actions/core';
import NotImplementedException from './error/not-implemented-exception';
import ValidationError from './error/validation-error';
import Input from './input';
import System from './system';

export default class Versioning {
  static get strategies() {
    return { None: 'None', Semantic: 'Semantic', Tag: 'Tag', Custom: 'Custom' };
  }

  static get grepCompatibleInputVersionRegex() {
    return '^v?([0-9]+\\.)*[0-9]+.*';
  }

  /**
   * Get the branch name of the (related) branch
   */
  static get branch() {
    return this.headRef || this.ref?.slice(11);
  }

  /**
   * For pull requests we can reliably use GITHUB_HEAD_REF
   */
  static get headRef() {
    return process.env.GITHUB_HEAD_REF;
  }

  /**
   * For branches GITHUB_REF will have format `refs/heads/feature-branch-1`
   */
  static get ref() {
    return process.env.GITHUB_REF;
  }

  /**
   * Maximum number of lines to print when logging the git diff
   */
  static get maxDiffLines() {
    return 60;
  }

  /**
   * Log up to maxDiffLines of the git diff.
   */
  static async logDiff() {
    const diffCommand = `git --no-pager diff | head -n ${this.maxDiffLines.toString()}`;
    await System.run(
      'sh',
      undefined,
      {
        input: Buffer.from(diffCommand),
        silent: true,
      },
      false,
    );
  }

  /**
   * Regex to parse version description into separate fields
   */
  static get descriptionRegexes(): RegExp[] {
    return [
      /^v?([\d.]+)-(\d+)-g(\w+)-?(\w+)*/g,
      /^v?([\d.]+-\w+)-(\d+)-g(\w+)-?(\w+)*/g,
      /^v?([\d.]+-\w+\.\d+)-(\d+)-g(\w+)-?(\w+)*/g,
    ];
  }

  static async determineBuildVersion(strategy: string, inputVersion: string): Promise<string> {
    // Validate input
    if (!Object.hasOwnProperty.call(this.strategies, strategy)) {
      throw new ValidationError(`Versioning strategy should be one of ${Object.values(this.strategies).join(', ')}.`);
    }

    switch (strategy) {
      case this.strategies.None:
        return 'none';
      case this.strategies.Custom:
        return inputVersion;
      case this.strategies.Semantic:
        return await this.generateSemanticVersion();
      case this.strategies.Tag:
        return await this.generateTagVersion();
      default:
        throw new NotImplementedException(`Strategy ${strategy} is not implemented.`);
    }
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
  static async generateSemanticVersion() {
    if (await this.isShallow()) {
      await this.fetch();
    }

    await this.logDiff();

    if ((await this.isDirty()) && !Input.allowDirtyBuild) {
      throw new Error('Branch is dirty. Refusing to base semantic version on uncommitted changes');
    }

    if (!(await this.hasAnyVersionTags())) {
      const version = `0.0.${await this.getTotalNumberOfCommits()}`;
      core.info(`Generated version ${version} (no version tags found).`);

      return version;
    }

    const versionDescriptor = await this.parseSemanticVersion();
    if (versionDescriptor) {
      const { tag, commits, hash } = versionDescriptor;

      // Ensure 3 digits (commits should always be patch level)
      const [major, minor, patch] = `${tag}.${commits}`.split('.');
      const threeDigitVersion = /^\d+$/.test(patch) ? `${major}.${minor}.${patch}` : `${major}.0.${minor}`;

      core.info(`Found semantic version ${threeDigitVersion} for ${this.branch}@${hash}`);

      return `${threeDigitVersion}`;
    }

    const version = `0.0.${await this.getTotalNumberOfCommits()}`;
    core.info(`Generated version ${version} (semantic version couldn't be determined).`);

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
    for (const descriptionRegex of Versioning.descriptionRegexes) {
      try {
        const [match, tag, commits, hash] = descriptionRegex.exec(description) as RegExpExecArray;

        return {
          match,
          tag,
          commits,
          hash,
        };
      } catch {
        continue;
      }
    }

    core.warning(`Failed to parse git describe output or version can not be determined through: "${description}".`);

    return false;
  }

  /**
   * Returns whether the repository is shallow.
   */
  static async isShallow() {
    const output = await this.git(['rev-parse', '--is-shallow-repository']);

    return output !== 'false\n';
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
    } catch (error) {
      core.warning(`Fetch --unshallow caught: ${error}`);
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
    return this.git(['describe', '--long', '--tags', '--always', 'HEAD']);
  }

  /**
   * Returns whether there are uncommitted changes that are not ignored.
   */
  static async isDirty() {
    const output = await this.git(['status', '--porcelain']);
    const isDirty = output !== '';

    if (isDirty) {
      core.warning('Changes were made to the following files and folders:\n');
      core.warning(output);
    }

    return isDirty;
  }

  /**
   * Get the tag if there is one pointing at HEAD
   */
  static async getTag() {
    return (await this.git(['tag', '--points-at', 'HEAD'])).trim();
  }

  /**
   * Whether the current tree has any version tags yet.
   *
   * Note: Currently this is run in all OSes, so the syntax must be cross-platform.
   */
  static async hasAnyVersionTags() {
    const numberOfTagsAsString = await System.run('sh', undefined, {
      input: Buffer.from(`git tag --list --merged HEAD | grep -E '${this.grepCompatibleInputVersionRegex}' | wc -l`),
      cwd: Input.projectPath,
      silent: false,
    });

    const numberOfTags = Number.parseInt(numberOfTagsAsString, 10);

    return numberOfTags !== 0;
  }

  /**
   * Get the total number of commits on head.
   *
   */
  static async getTotalNumberOfCommits() {
    const numberOfCommitsAsString = await this.git(['rev-list', '--count', 'HEAD']);

    return Number.parseInt(numberOfCommitsAsString, 10);
  }

  /**
   * Run git in the specified project path
   */
  static async git(arguments_: string[], options = {}) {
    return System.run('git', arguments_, { cwd: Input.projectPath, ...options }, false);
  }
}
