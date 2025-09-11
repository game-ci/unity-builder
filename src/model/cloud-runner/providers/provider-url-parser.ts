import CloudRunnerLogger from '../services/core/cloud-runner-logger';

export interface GitHubUrlInfo {
  type: 'github';
  owner: string;
  repo: string;
  branch?: string;
  path?: string;
  url: string;
}

export interface LocalPathInfo {
  type: 'local';
  path: string;
}

export interface NpmPackageInfo {
  type: 'npm';
  packageName: string;
}

export type ProviderSourceInfo = GitHubUrlInfo | LocalPathInfo | NpmPackageInfo;

/**
 * Parses a provider source string and determines its type and details
 * @param source The provider source string (URL, path, or package name)
 * @returns ProviderSourceInfo object with parsed details
 */
export function parseProviderSource(source: string): ProviderSourceInfo {
  // Check if it's a GitHub URL
  const githubMatch = source.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?(?:tree\/([^/]+))?(?:\/(.+))?$/,
  );
  if (githubMatch) {
    const [, owner, repo, branch, path] = githubMatch;

    return {
      type: 'github',
      owner,
      repo,
      branch: branch || 'main',
      path: path || '',
      url: source,
    };
  }

  // Check if it's a GitHub SSH URL
  const githubSshMatch = source.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?\/?(?:tree\/([^/]+))?(?:\/(.+))?$/);
  if (githubSshMatch) {
    const [, owner, repo, branch, path] = githubSshMatch;

    return {
      type: 'github',
      owner,
      repo,
      branch: branch || 'main',
      path: path || '',
      url: `https://github.com/${owner}/${repo}`,
    };
  }

  // Check if it's a shorthand GitHub reference (owner/repo)
  const shorthandMatch = source.match(/^([^/@]+)\/([^/@]+)(?:@([^/]+))?(?:\/(.+))?$/);
  if (shorthandMatch && !source.startsWith('.') && !source.startsWith('/') && !source.includes('\\')) {
    const [, owner, repo, branch, path] = shorthandMatch;

    return {
      type: 'github',
      owner,
      repo,
      branch: branch || 'main',
      path: path || '',
      url: `https://github.com/${owner}/${repo}`,
    };
  }

  // Check if it's a local path
  if (source.startsWith('./') || source.startsWith('../') || source.startsWith('/') || source.includes('\\')) {
    return {
      type: 'local',
      path: source,
    };
  }

  // Default to npm package
  return {
    type: 'npm',
    packageName: source,
  };
}

/**
 * Generates a cache key for a GitHub repository
 * @param urlInfo GitHub URL information
 * @returns Cache key string
 */
export function generateCacheKey(urlInfo: GitHubUrlInfo): string {
  return `github_${urlInfo.owner}_${urlInfo.repo}_${urlInfo.branch}`.replace(/[^\w-]/g, '_');
}

/**
 * Validates if a string looks like a valid GitHub URL or reference
 * @param source The source string to validate
 * @returns True if it looks like a GitHub reference
 */
export function isGitHubSource(source: string): boolean {
  const parsed = parseProviderSource(source);

  return parsed.type === 'github';
}

/**
 * Logs the parsed provider source information
 * @param source The original source string
 * @param parsed The parsed source information
 */
export function logProviderSource(source: string, parsed: ProviderSourceInfo): void {
  CloudRunnerLogger.log(`Provider source: ${source}`);
  switch (parsed.type) {
    case 'github':
      CloudRunnerLogger.log(`  Type: GitHub repository`);
      CloudRunnerLogger.log(`  Owner: ${parsed.owner}`);
      CloudRunnerLogger.log(`  Repository: ${parsed.repo}`);
      CloudRunnerLogger.log(`  Branch: ${parsed.branch}`);
      if (parsed.path) {
        CloudRunnerLogger.log(`  Path: ${parsed.path}`);
      }
      break;
    case 'local':
      CloudRunnerLogger.log(`  Type: Local path`);
      CloudRunnerLogger.log(`  Path: ${parsed.path}`);
      break;
    case 'npm':
      CloudRunnerLogger.log(`  Type: NPM package`);
      CloudRunnerLogger.log(`  Package: ${parsed.packageName}`);
      break;
  }
}
