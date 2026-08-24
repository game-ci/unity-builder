import { describe, it, expect, vi } from 'vitest';
import { assetNameFor, binaryNameFor, resolveLatestTag } from './download-cli';

describe('assetNameFor', () => {
  it('maps linux x64 to a .tar.gz archive', () => {
    expect(assetNameFor('linux', 'x64')).toBe('game-ci-linux-x64.tar.gz');
  });

  it('maps linux arm64 to a .tar.gz archive', () => {
    expect(assetNameFor('linux', 'arm64')).toBe('game-ci-linux-arm64.tar.gz');
  });

  it('maps darwin x64 to a .tar.gz archive', () => {
    expect(assetNameFor('darwin', 'x64')).toBe('game-ci-macos-x64.tar.gz');
  });

  it('maps darwin arm64 to a .tar.gz archive', () => {
    expect(assetNameFor('darwin', 'arm64')).toBe('game-ci-macos-arm64.tar.gz');
  });

  it('maps win32 x64 to a .zip archive', () => {
    expect(assetNameFor('win32', 'x64')).toBe('game-ci-windows-x64.zip');
  });

  it('throws for an unsupported platform/arch combination', () => {
    expect(() => assetNameFor('win32', 'arm64')).toThrow(/unsupported/i);
    expect(() => assetNameFor('freebsd', 'x64')).toThrow(/unsupported/i);
  });
});

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
