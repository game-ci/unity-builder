import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';

const CLI_REPO = 'game-ci/cli';

export function assetNameFor(platform: NodeJS.Platform, arch: string): string {
  const targets: Partial<Record<NodeJS.Platform, Partial<Record<string, string>>>> = {
    linux: { x64: 'linux-x64', arm64: 'linux-arm64' },
    darwin: { x64: 'macos-x64', arm64: 'macos-arm64' },
    win32: { x64: 'windows-x64' },
  };

  const target = targets[platform]?.[arch];
  if (!target)
    throw new Error(`Unsupported platform/arch for the game-ci CLI: ${platform}/${arch}`);

  const extension = platform === 'win32' ? 'zip' : 'tar.gz';

  return `game-ci-${target}.${extension}`;
}

/** The binary's name once extracted - matches release-cli.yml's per-platform `binary` matrix value. */
export function binaryNameFor(platform: NodeJS.Platform): string {
  return platform === 'win32' ? 'game-ci.exe' : 'game-ci';
}

/**
 * Downloads (or reuses a cached copy of) the game-ci CLI release archive
 * matching the current runner, extracts it, and returns the path to the
 * binary inside.
 *
 * The archive - not a bare binary - is what's published: cli.ts resolves
 * its own static assets (default-build-script/, platforms/*,
 * unity-config/services-config.json.template, all needed for Docker
 * volume mounts) relative to its own directory on disk, and those assets
 * aren't embedded in the compiled binary itself. dist/ ships as the
 * binary's sibling inside the archive - see game-ci/cli#73.
 *
 * Pinned versions are cached via @actions/cache (GitHub's cache service),
 * so repeat jobs on ephemeral, GitHub-hosted runners skip the download
 * entirely - @actions/tool-cache alone only survives for the life of one
 * runner's disk, which GitHub-hosted runners don't persist between jobs.
 * "latest" is intentionally never persisted this way: caching a moving
 * target under a fixed key would silently pin every job to whatever
 * version happened to be "latest" on the first cache write.
 *
 * @param version A release tag (e.g. "v0.1.0"), or "latest".
 */
export async function downloadCli(version: string): Promise<string> {
  const asset = assetNameFor(process.platform, process.arch);
  const binaryName = binaryNameFor(process.platform);
  const isPinned = version !== 'latest';

  if (isPinned) {
    const cached = await restoreFromCache(version, binaryName);
    if (cached) return cached;
  }

  const url = isPinned
    ? `https://github.com/${CLI_REPO}/releases/download/${version}/${asset}`
    : `https://github.com/${CLI_REPO}/releases/latest/download/${asset}`;

  core.info(`Downloading game-ci CLI (${version}) from ${url}`);
  const archivePath = await tc.downloadTool(url);
  const extractedDir =
    process.platform === 'win32'
      ? await tc.extractZip(archivePath)
      : await tc.extractTar(archivePath);

  const binaryPath = path.join(extractedDir, binaryName);
  if (process.platform !== 'win32') {
    await fs.chmod(binaryPath, 0o755);
  }

  if (isPinned) {
    await saveToCache(version, binaryName, extractedDir);
  }

  return binaryPath;
}

function cacheDirFor(version: string): string {
  return path.join(os.tmpdir(), 'game-ci-cli-cache', version);
}

function cacheKeyFor(version: string, binaryName: string): string {
  return `game-ci-cli-${version}-${binaryName}`;
}

async function restoreFromCache(version: string, binaryName: string): Promise<string | null> {
  if (!cache.isFeatureAvailable()) return null;

  const cacheDir = cacheDirFor(version);
  try {
    const hitKey = await cache.restoreCache([cacheDir], cacheKeyFor(version, binaryName));
    if (!hitKey) return null;

    const binaryPath = path.join(cacheDir, binaryName);
    // Cache restore doesn't guarantee the executable bit survives.
    if (process.platform !== 'win32') await fs.chmod(binaryPath, 0o755);

    core.info(`Restored game-ci CLI ${version} from cache`);
    return binaryPath;
  } catch (error: any) {
    core.warning(`Failed to restore game-ci CLI from cache: ${error.message}`);
    return null;
  }
}

async function saveToCache(
  version: string,
  binaryName: string,
  extractedDir: string,
): Promise<void> {
  if (!cache.isFeatureAvailable()) return;

  const cacheDir = cacheDirFor(version);
  try {
    await fs.mkdir(path.dirname(cacheDir), { recursive: true });
    await fs.cp(extractedDir, cacheDir, { recursive: true });
    await cache.saveCache([cacheDir], cacheKeyFor(version, binaryName));
  } catch (error: any) {
    // A cache miss on save (e.g. another concurrent job already saved this
    // key) isn't fatal - the download itself already succeeded.
    core.warning(`Failed to save game-ci CLI to cache: ${error.message}`);
  }
}
