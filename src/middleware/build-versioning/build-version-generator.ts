import NotImplementedException from '../../model/error/not-implemented-exception.ts';
import Input from '../../model/input.ts';
import System from '../../model/system/system.ts';
import { Action } from '../../model/index.ts';
import { VersioningStrategy } from '../../model/versioning/versioning-strategy.ts';

export default class BuildVersionGenerator {
  private readonly maxDiffLines: number = 60;
  private readonly projectPath: string;

  constructor(projectPath, currentBranch) {
    this.projectPath = projectPath;
    this.currentBranch = currentBranch;
  }

  // Todo - move more of the get detection logic to the vcs detection class
  public async determineBuildVersion(strategy: string, inputVersion: string, allowDirtyBuild: boolean) {
    log.info('Versioning strategy:', strategy);

    let version;
    switch (strategy) {
      case VersioningStrategy.None:
        version = 'none';
        break;
      case VersioningStrategy.Custom:
        version = inputVersion;
        break;
      case VersioningStrategy.Semantic:
        version = await this.generateSemanticVersion(allowDirtyBuild);
        break;
      case VersioningStrategy.Tag:
        version = await this.generateTagVersion();
        break;
      default:
        throw new NotImplementedException(`Strategy ${strategy} is not implemented.`);
    }

    log.info('Version of this build:', version);

    return version;
  }

  private get grepCompatibleInputVersionRegex() {
    return '^v?([0-9]+\\.)*[0-9]+.*';
  }

  /**
   * Get the branch name of the (related) branch
   */
  private async getCurrentBranch() {}

  /**
   * The commit SHA that triggered the workflow run.
   * @deprecated
   */
  private get sha() {
    return Deno.env.get('GITHUB_SHA');
  }

  /**
   * Regex to parse version description into separate fields
   */
  private get descriptionRegex1() {
    return /^v?([\d.]+)-(\d+)-g(\w+)-?(\w+)*/g;
  }

  private get descriptionRegex2() {
    return /^v?([\d.]+-\w+)-(\d+)-g(\w+)-?(\w+)*/g;
  }

  private get descriptionRegex3() {
    return /^v?([\d.]+-\w+\.\d+)-(\d+)-g(\w+)-?(\w+)*/g;
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
  private async generateSemanticVersion(allowDirtyBuild) {
    if (await this.isShallow()) {
      await this.fetch();
    }

    if ((await this.isDirty()) && !allowDirtyBuild) {
      await BuildVersionGenerator.logDiff();
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

      log.info(`Found semantic version ${threeDigitVersion} for ${this.currentBranch}@${hash}`);

      return `${threeDigitVersion}`;
    }

    const version = `0.0.${await this.getTotalNumberOfCommits()}`;
    log.info(`Generated version ${version} (semantic version couldn't be determined).`);

    return version;
  }

  /**
   * Generate the proper version for unity based on an existing tag.
   */
  private async generateTagVersion() {
    let tag = await this.getTag();

    if (tag.charAt(0) === 'v') {
      tag = tag.slice(1);
    }

    return tag;
  }

  /**
   * Parses the versionDescription into their named parts.
   */
  private async parseSemanticVersion() {
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
  private async isShallow() {
    const output = await this.git('rev-parse --is-shallow-repository');

    return output !== 'false';
  }

  /**
   * Retrieves refs from the configured remote.
   *
   * Fetch unshallow for incomplete repository, but fall back to normal fetch.
   *
   * Note: `--all` should not be used, and would break fetching for push event.
   */
  private async fetch() {
    try {
      await this.git('fetch --unshallow');
    } catch {
      log.warning(`fetch --unshallow did not work, falling back to regular fetch`);
      await this.git('fetch');
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
  private async getVersionDescription() {
    let commitIsh = '';

    // In CI the repo is checked out in detached head mode.
    // We MUST specify the commitIsh that triggered the job.
    // Todo - make this compatible with more CI systems
    if (!Action.isRunningLocally) {
      commitIsh = this.sha;
    }

    return this.git(`describe --long --tags --always ${commitIsh}`);
  }

  /**
   * Returns whether there are uncommitted changes that are not ignored.
   */
  private async isDirty() {
    const output = await this.git('status --porcelain');
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
  private async getTag() {
    return await this.git('tag --points-at HEAD');
  }

  /**
   * Whether the current tree has any version tags yet.
   *
   * Note: Currently this is run in all OSes, so the syntax must be cross-platform.
   */
  private async hasAnyVersionTags() {
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
  private async getTotalNumberOfCommits() {
    const numberOfCommitsAsString = await this.git(`rev-list --count ${this.sha}`);

    return Number.parseInt(numberOfCommitsAsString, 10);
  }

  /**
   * Run git in the specified project path
   */
  private async git(arguments_, options = {}) {
    const result = await System.run(`git ${arguments_}`, { cwd: this.projectPath, ...options });

    log.warning(result);

    return result.output;
  }
}
