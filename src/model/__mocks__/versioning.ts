/* eslint unicorn/prevent-abbreviations: "off" */

// Import these named export into your test file:
export const mockProjectPath = jest.fn().mockResolvedValue('mockProjectPath');
export const mockIsDirtyAllowed = jest.fn().mockResolvedValue(false);
export const mockBranch = jest.fn().mockResolvedValue('mockBranch');
export const mockHeadRef = jest.fn().mockResolvedValue('mockHeadRef');
export const mockRef = jest.fn().mockResolvedValue('mockRef');
export const mockDetermineVersion = jest.fn().mockResolvedValue('1.2.3');
export const mockGenerateSemanticVersion = jest.fn().mockResolvedValue('2.3.4');
export const mockGenerateTagVersion = jest.fn().mockResolvedValue('1.0');
export const mockParseSemanticVersion = jest.fn().mockResolvedValue({});
export const mockFetch = jest.fn().mockImplementation(() => {});
export const mockGetVersionDescription = jest.fn().mockResolvedValue('1.2-3-g12345678-dirty');
export const mockIsDirty = jest.fn().mockResolvedValue(false);
export const mockGetTag = jest.fn().mockResolvedValue('v1.0');
export const mockHasAnyVersionTags = jest.fn().mockResolvedValue(true);
export const mockGetTotalNumberOfCommits = jest.fn().mockResolvedValue(3);
export const mockGit = jest.fn().mockImplementation(() => {});

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
