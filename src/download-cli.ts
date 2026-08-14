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

  return platform === 'win32' ? `game-ci-${target}.exe` : `game-ci-${target}`;
}

/**
 * Downloads (or reuses a cached copy of) the game-ci CLI binary matching the
 * current runner, and returns its path.
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
  const isPinned = version !== 'latest';

  if (isPinned) {
    const cached = await restoreFromCache(version, asset);
    if (cached) return cached;
  }

  const url = isPinned
    ? `https://github.com/${CLI_REPO}/releases/download/${version}/${asset}`
    : `https://github.com/${CLI_REPO}/releases/latest/download/${asset}`;

  core.info(`Downloading game-ci CLI (${version}) from ${url}`);
  const downloadedPath = await tc.downloadTool(url);

  if (process.platform !== 'win32') {
    await fs.chmod(downloadedPath, 0o755);
  }

  if (isPinned) {
    await saveToCache(version, asset, downloadedPath);
  }

  return downloadedPath;
}

function cachePathFor(version: string, asset: string): string {
  return path.join(os.tmpdir(), 'game-ci-cli-cache', version, asset);
}

function cacheKeyFor(version: string, asset: string): string {
  return `game-ci-cli-${version}-${asset}`;
}

async function restoreFromCache(version: string, asset: string): Promise<string | null> {
  if (!cache.isFeatureAvailable()) return null;

  const cachePath = cachePathFor(version, asset);
  try {
    const hitKey = await cache.restoreCache([cachePath], cacheKeyFor(version, asset));
    if (!hitKey) return null;

    // Cache restore doesn't guarantee the executable bit survives.
    if (process.platform !== 'win32') await fs.chmod(cachePath, 0o755);

    core.info(`Restored game-ci CLI ${version} from cache`);
    return cachePath;
  } catch (error: any) {
    core.warning(`Failed to restore game-ci CLI from cache: ${error.message}`);
    return null;
  }
}

async function saveToCache(version: string, asset: string, downloadedPath: string): Promise<void> {
  if (!cache.isFeatureAvailable()) return;

  const cachePath = cachePathFor(version, asset);
  try {
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.copyFile(downloadedPath, cachePath);
    await cache.saveCache([cachePath], cacheKeyFor(version, asset));
  } catch (error: any) {
    // A cache miss on save (e.g. another concurrent job already saved this
    // key) isn't fatal - the download itself already succeeded.
    core.warning(`Failed to save game-ci CLI to cache: ${error.message}`);
  }
}
