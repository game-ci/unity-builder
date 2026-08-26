import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as cache from '@actions/cache';
import * as exec from '@actions/exec';
import { binaryNameFor, downloadCli, resolveLatestTag } from './download-cli';

vi.mock('@actions/exec');
vi.mock('@actions/cache');

describe('binaryNameFor', () => {
  it('is game-ci.exe on win32', () => {
    expect(binaryNameFor('win32')).toBe('game-ci.exe');
  });

  it('is game-ci on every other platform', () => {
    expect(binaryNameFor('linux')).toBe('game-ci');
    expect(binaryNameFor('darwin')).toBe('game-ci');
  });
});

describe('resolveLatestTag', () => {
  // This is the piece that makes caching "latest" possible at all: caching
  // under the literal string "latest" would silently pin every job to
  // whatever version happened to be current on the first cache write.
  // Resolving to the concrete tag first means a real new release is a fresh
  // cache key (a miss by construction), never a stale hit.
  it('returns the tag_name from a successful GitHub API response', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ tag_name: 'v0.1.15' }),
    })) as unknown as typeof fetch;

    const tag = await resolveLatestTag(fetchFn);

    expect(tag).toBe('v0.1.15');
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.github.com/repos/game-ci/cli/releases/latest',
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: 'application/vnd.github+json' }),
      }),
    );
  });

  it('sends no Authorization header when GITHUB_TOKEN/GH_TOKEN are unset', async () => {
    const originalGithub = process.env.GITHUB_TOKEN;
    const originalGh = process.env.GH_TOKEN;
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;

    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ tag_name: 'v0.1.15' }),
    })) as unknown as typeof fetch;

    try {
      await resolveLatestTag(fetchFn);
      const [, init] = vi.mocked(fetchFn).mock.calls[0] as [
        string,
        RequestInit & { headers: Record<string, string> },
      ];
      expect(init.headers.Authorization).toBeUndefined();
    } finally {
      if (originalGithub !== undefined) process.env.GITHUB_TOKEN = originalGithub;
      if (originalGh !== undefined) process.env.GH_TOKEN = originalGh;
    }
  });

  it('sends an Authorization header from GITHUB_TOKEN when set, to avoid the unauthenticated rate limit', async () => {
    const original = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = 'test-token-123';

    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ tag_name: 'v0.1.15' }),
    })) as unknown as typeof fetch;

    try {
      await resolveLatestTag(fetchFn);
      expect(fetchFn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer test-token-123' }),
        }),
      );
    } finally {
      if (original === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = original;
    }
  });

  it('throws with a clear message on a non-ok response', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(resolveLatestTag(fetchFn)).rejects.toThrow(/404/);
  });

  it('throws with a clear message when the response has no tag_name', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(resolveLatestTag(fetchFn)).rejects.toThrow(/no tag_name/);
  });
});

describe('downloadCli', () => {
  beforeEach(() => {
    vi.mocked(cache.isFeatureAvailable).mockReturnValue(false);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // The actual install mechanics (platform detection, archive format,
  // extraction) live in game-ci/cli's own scripts/install.sh now, fetched
  // and run at the resolved version's tag - see game-ci/cli#187. This
  // wrapper's own job is just: build that command correctly, and take
  // install.sh's stdout as the binary path.
  it('fetches and runs install.sh for the given version, returning its stdout as the binary path', async () => {
    vi.mocked(exec.exec).mockImplementation(async (_cmd, _args, options) => {
      options?.listeners?.stdout?.(Buffer.from('/tmp/game-ci-cli-cache/v0.1.32/game-ci\n'));
      return 0;
    });

    const binaryPath = await downloadCli('v0.1.32');

    expect(binaryPath).toBe('/tmp/game-ci-cli-cache/v0.1.32/game-ci');
    expect(exec.exec).toHaveBeenCalledWith(
      'bash',
      expect.arrayContaining([
        'https://raw.githubusercontent.com/game-ci/cli/v0.1.32/scripts/install.sh',
        'v0.1.32',
      ]),
      expect.anything(),
    );
  });

  it('resolves "latest" to a concrete tag before fetching install.sh', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ tag_name: 'v0.1.33' }),
    })) as unknown as typeof fetch;

    vi.mocked(exec.exec).mockImplementation(async (_cmd, _args, options) => {
      options?.listeners?.stdout?.(Buffer.from('/tmp/game-ci\n'));
      return 0;
    });

    try {
      await downloadCli('latest');

      expect(exec.exec).toHaveBeenCalledWith(
        'bash',
        expect.arrayContaining([
          'https://raw.githubusercontent.com/game-ci/cli/v0.1.33/scripts/install.sh',
          'v0.1.33',
        ]),
        expect.anything(),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('throws a clear error when install.sh produces no output', async () => {
    vi.mocked(exec.exec).mockImplementation(async () => 0);

    await expect(downloadCli('v0.1.32')).rejects.toThrow(/produced no output/);
  });

  it('restores from cache instead of running install.sh on a cache hit', async () => {
    vi.mocked(cache.isFeatureAvailable).mockReturnValue(true);
    vi.mocked(cache.restoreCache).mockResolvedValue('game-ci-cli-v0.1.32-key');

    const binaryPath = await downloadCli('v0.1.32');

    expect(binaryPath).toContain(binaryNameFor(process.platform));
    expect(exec.exec).not.toHaveBeenCalled();
  });
});
