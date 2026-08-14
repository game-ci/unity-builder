import { describe, it, expect } from 'vitest';
import { assetNameFor, binaryNameFor } from './download-cli';

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
