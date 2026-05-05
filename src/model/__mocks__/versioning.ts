import { vi } from 'vitest';
/* eslint unicorn/prevent-abbreviations: "off" */

// Import these named export into your test file:
export const mockProjectPath = vi.fn().mockResolvedValue('mockProjectPath');
export const mockIsDirtyAllowed = vi.fn().mockResolvedValue(false);
export const mockBranch = vi.fn().mockResolvedValue('mockBranch');
export const mockHeadRef = vi.fn().mockResolvedValue('mockHeadRef');
export const mockRef = vi.fn().mockResolvedValue('mockRef');
export const mockDetermineVersion = vi.fn().mockResolvedValue('1.2.3');
export const mockGenerateSemanticVersion = vi.fn().mockResolvedValue('2.3.4');
export const mockGenerateTagVersion = vi.fn().mockResolvedValue('1.0');
export const mockParseSemanticVersion = vi.fn().mockResolvedValue({});
export const mockFetch = vi.fn().mockImplementation(() => {});
export const mockGetVersionDescription = vi.fn().mockResolvedValue('1.2-3-g12345678-dirty');
export const mockIsDirty = vi.fn().mockResolvedValue(false);
export const mockGetTag = vi.fn().mockResolvedValue('v1.0');
export const mockHasAnyVersionTags = vi.fn().mockResolvedValue(true);
export const mockGetTotalNumberOfCommits = vi.fn().mockResolvedValue(3);
export const mockGit = vi.fn().mockImplementation(() => {});

export default {
  projectPath: mockProjectPath,
  isDirtyAllowed: mockIsDirtyAllowed,
  branch: mockBranch,
  headRef: mockHeadRef,
  ref: mockRef,
  determineVersion: mockDetermineVersion,
  generateSemanticVersion: mockGenerateSemanticVersion,
  generateTagVersion: mockGenerateTagVersion,
  parseSemanticVersion: mockParseSemanticVersion,
  fetch: mockFetch,
  getVersionDescription: mockGetVersionDescription,
  isDirty: mockIsDirty,
  getTag: mockGetTag,
  hasAnyVersionTags: mockHasAnyVersionTags,
  getTotalNumberOfCommits: mockGetTotalNumberOfCommits,
  git: mockGit,
};
