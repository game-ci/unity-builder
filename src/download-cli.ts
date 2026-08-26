import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as exec from '@actions/exec';

const CLI_REPO = 'game-ci/cli';

/** The binary's name once extracted - matches release-cli.yml's per-platform `binary` matrix value. */
export function binaryNameFor(platform: NodeJS.Platform): string {
  return platform === 'win32' ? 'game-ci.exe' : 'game-ci';
}

/**
 * Resolves the "latest" alias to the actual release tag it currently
 * points to, via a small GitHub API call - not the release-asset
 * redirect, which never reveals the concrete tag it landed on. This is
 * what makes caching "latest" possible at all: caching under the literal
 * string "latest" would silently pin every job to whatever version
 * happened to be current on the first cache write, but caching under the
 * *resolved* tag self-invalidates the moment a new release ships (a new
 * tag is a cache miss by construction), while still hitting cache on
 * every run in between. It's also what pins install.sh (below) to a
 * specific, immutable version rather than "latest" - install.sh doesn't
 * know how to resolve "latest" itself, by design, since which tag it's
 * fetched at IS the version it installs.
 */
export async function resolveLatestTag(fetchFn: typeof fetch = fetch): Promise<string> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  // Actions runners share IPs across many concurrent jobs from unrelated
  // repos/orgs, so the unauthenticated rate limit (60 req/hour per IP) gets
  // exhausted by traffic this job never generated. The default GITHUB_TOKEN
  // reads public repo data (game-ci/cli's releases) fine regardless of which
  // repo the workflow runs in, and lifts the limit to 5000 req/hour.
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetchFn(`https://api.github.com/repos/${CLI_REPO}/releases/latest`, {
    headers,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to resolve the latest game-ci CLI release: GitHub API returned ${response.status}.`,
    );
  }

  const body = (await response.json()) as { tag_name?: string };
  if (!body.tag_name) {
    throw new Error('Failed to resolve the latest game-ci CLI release: response had no tag_name.');
  }

  return body.tag_name;
}

function cacheDirFor(version: string): string {
  return path.join(os.tmpdir(), 'game-ci-cli-cache', version);
}

/**
 * Includes platform+arch, not just version: darwin-x64 and darwin-arm64
 * (or any two architectures on the same OS) both extract to a binary
 * named plain "game-ci", so a key built from version+binaryName alone
 * (this cache's previous scheme) can't tell them apart and would let one
 * architecture's binary get restored onto the other's runner.
 */
function cacheKeyFor(version: string): string {
  return `game-ci-cli-${version}-${process.platform}-${process.arch}`;
}

async function restoreFromCache(version: string): Promise<string | null> {
  if (!cache.isFeatureAvailable()) return null;

  const cacheDir = cacheDirFor(version);
  try {
    const hitKey = await cache.restoreCache([cacheDir], cacheKeyFor(version));
    if (!hitKey) return null;

    const binaryPath = path.join(cacheDir, binaryNameFor(process.platform));
    // Cache restore doesn't guarantee the executable bit survives.
    if (process.platform !== 'win32') await fs.chmod(binaryPath, 0o755);

    core.info(`Restored game-ci CLI ${version} from cache`);
    return binaryPath;
  } catch (error: any) {
    core.warning(`Failed to restore game-ci CLI from cache: ${error.message}`);
    return null;
  }
}

async function saveToCache(version: string): Promise<void> {
  if (!cache.isFeatureAvailable()) return;

  try {
    await cache.saveCache([cacheDirFor(version)], cacheKeyFor(version));
  } catch (error: any) {
    // A cache miss on save (e.g. another concurrent job already saved this
    // key) isn't fatal - the install itself already succeeded.
    core.warning(`Failed to save game-ci CLI to cache: ${error.message}`);
  }
}

/**
 * Downloads (or reuses a cached copy of) the game-ci CLI release archive
 * matching the current runner, extracts it, and returns the path to the
 * binary inside.
 *
 * The actual install mechanics - platform/arch detection, archive format,
 * download, extraction - live in exactly one place: game-ci/cli's own
 * scripts/install.sh, fetched and run at the resolved version's tag. That
 * script is what every engine wrapper (this one today, others later)
 * delegates to, so a bugfix or a new supported platform ships once, there,
 * and every wrapper picks it up on its next run with no code change of its
 * own - see game-ci/cli#187. GitHub Actions caching stays here, in the
 * wrapper: it's an Actions-only service with no shell-callable API, so
 * install.sh has no way to drive it itself.
 *
 * Every version - including "latest" - is cached via @actions/cache
 * (GitHub's cache service), so repeat jobs on ephemeral, GitHub-hosted
 * runners skip the archive download entirely. "latest" is resolved to its
 * concrete tag first (see resolveLatestTag) and cached under *that*, not
 * under the literal string "latest" - a real new release is a fresh tag,
 * so it's a cache miss by construction, never a stale hit.
 *
 * @param version A release tag (e.g. "v0.1.0"), or "latest".
 */
export async function downloadCli(version: string): Promise<string> {
  const resolvedVersion = version === 'latest' ? await resolveLatestTag() : version;

  const cached = await restoreFromCache(resolvedVersion);
  if (cached) return cached;

  const destDir = cacheDirFor(resolvedVersion);
  await fs.mkdir(destDir, { recursive: true });

  const installScriptUrl = `https://raw.githubusercontent.com/${CLI_REPO}/${resolvedVersion}/scripts/install.sh`;
  core.info(`Installing game-ci CLI ${resolvedVersion} via ${installScriptUrl}`);

  let stdout = '';
  await exec.exec(
    'bash',
    [
      '-c',
      // `set -o pipefail` matters here: without it, a failed curl (e.g. a
      // typo'd/deleted tag giving a 404) still exits 0 because it's not the
      // pipeline's last command, and the inner `bash -s` would silently run
      // on an empty script instead of failing loudly.
      'set -o pipefail; curl -fsSL "$0" | bash -s -- "$1" "$2"',
      installScriptUrl,
      resolvedVersion,
      destDir,
    ],
    {
      listeners: {
        stdout: (data: Buffer) => {
          stdout += data.toString();
        },
      },
    },
  );

  // install.sh writes progress to stderr and only the final binary path to
  // stdout, but take the last non-empty line regardless - defensive against
  // any stray stdout noise from a future version of the script.
  const binaryPath = stdout
    .split('\n')
    .map((line) => line.trim())
    .toReversed()
    .find(Boolean);

  if (!binaryPath) {
    throw new Error(
      `Failed to install the game-ci CLI ${resolvedVersion}: install.sh produced no output.`,
    );
  }

  await saveToCache(resolvedVersion);

  return binaryPath;
}
