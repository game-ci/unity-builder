import { describe, it, expect } from 'vitest';
import { assetNameFor } from './download-cli';

describe('assetNameFor', () => {
  it('maps linux x64', () => {
    expect(assetNameFor('linux', 'x64')).toBe('game-ci-linux-x64');
  });

  it('maps linux arm64', () => {
    expect(assetNameFor('linux', 'arm64')).toBe('game-ci-linux-arm64');
  });

  it('maps darwin x64', () => {
    expect(assetNameFor('darwin', 'x64')).toBe('game-ci-macos-x64');
  });

  it('maps darwin arm64', () => {
    expect(assetNameFor('darwin', 'arm64')).toBe('game-ci-macos-arm64');
  });

  it('maps win32 x64 with an .exe suffix', () => {
    expect(assetNameFor('win32', 'x64')).toBe('game-ci-windows-x64.exe');
  });

  it('throws for an unsupported platform/arch combination', () => {
    expect(() => assetNameFor('win32', 'arm64')).toThrow(/unsupported/i);
    expect(() => assetNameFor('freebsd', 'x64')).toThrow(/unsupported/i);
  });
});
