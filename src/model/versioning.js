import * as core from '@actions/core';
import NotImplementedException from './error/not-implemented-exception';
import ValidationError from './error/validation-error';
import Input from './input';
import System from './system';

export default class Versioning {
  static get projectPath() {
    return Input.projectPath;
  }

  static get isDirtyAllowed() {
    return Input.allowDirtyBuild === 'true';
  }

  static get strategies() {
    return { None: 'None', Semantic: 'Semantic', Tag: 'Tag', Custom: 'Custom' };
  }

  /**
   * Get the branch name of the (related) branch
   */
  static get branch() {
    // Todo - use optional chaining (https://github.com/zeit/ncc/issues/534)
    return this.headRef || (this.ref && this.ref.slice(11));
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
   * The commit SHA that triggered the workflow run.
   */
  static get sha() {
    return process.env.GITHUB_SHA;
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
    await System.run('sh', undefined, {
      input: Buffer.from(diffCommand),
      silent: true,
    });
  }

  /**
   * Regex to parse version description into separate fields
   */
  static get descriptionRegex() {
    return /^v([\d.]+)-(\d+)-g(\w+)-?(\w+)*/g;
  }

  static async determineVersion(strategy, inputVersion) {
    // Validate input
    if (!Object.hasOwnProperty.call(this.strategies, strategy)) {
      throw new ValidationError(
        `Versioning strategy should be one of ${Object.values(this.strategies).join(', ')}.`,
      );
    }

    let version;
    switch (strategy) {
      case this.strategies.None:
        version = 'none';
        break;
      case this.strategies.Custom:
        version = inputVersion;
        break;
      case this.strategies.Semantic:
        version = await this.generateSemanticVersion();
        break;
      case this.strategies.Tag:
        version = await this.generateTagVersion();
        break;
      default:
        throw new NotImplementedException(`Strategy ${strategy} is not implemented.`);
    }

    return version;
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
    await this.fetch();

    await this.logDiff();

    if ((await this.isDirty()) && !this.isDirtyAllowed) {
      throw new Error('Branch is dirty. Refusing to base semantic version on uncommitted changes');
    }

    if (!(await this.hasAnyVersionTags())) {
      const version = `0.0.${await this.getTotalNumberOfCommits()}`;
      core.info(`Generated version ${version} (no version tags found).`);
      return version;
    }

    const { tag, commits, hash } = await this.parseSemanticVersion();
    core.info(`Found semantic version ${tag}.${commits} for ${this.branch}@${hash}`);

    return `${tag}.${commits}`;
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
      const [match, tag, commits, hash] = this.descriptionRegex.exec(description);

      return {
        match,
        tag,
        commits,
        hash,
      };
    } catch (error) {
      throw new Error(`Failed to parse git describe output: "${description}".`);
    }
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
    return this.git(['describe', '--long', '--tags', '--always', '--debug', this.sha]);
  }

  /**
   * Returns whether there are uncommitted changes that are not ignored.
   */
  static async isDirty() {
    const output = await this.git(['status', '--porcelain']);

    return output !== '';
  }

  /**
   * Get the tag if there is one pointing at HEAD
   */
  static async getTag() {
    return this.git(['tag', '--points-at', 'HEAD']);
  }

  /**
   * Whether or not the repository has any version tags yet.
   */
  static async hasAnyVersionTags() {
    const numberOfCommitsAsString = await System.run('sh', undefined, {
      input: Buffer.from('git tag --list --merged HEAD | grep v[0-9]* | wc -l'),
      silent: false,
    });

    const numberOfCommits = Number.parseInt(numberOfCommitsAsString, 10);

    return numberOfCommits !== 0;
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
