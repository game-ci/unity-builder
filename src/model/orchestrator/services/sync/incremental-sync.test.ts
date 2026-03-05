import fs from 'node:fs';
import path from 'node:path';
import { IncrementalSyncService } from './incremental-sync-service';
import { SyncStateManager } from './sync-state-manager';
import { SyncState } from './sync-state';
import { OrchestratorSystem } from '../core/orchestrator-system';
import OrchestratorLogger from '../core/orchestrator-logger';

// Mock dependencies
jest.mock('node:fs');
jest.mock('../core/orchestrator-system');
jest.mock('../core/orchestrator-logger');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockSystem = OrchestratorSystem as jest.Mocked<typeof OrchestratorSystem>;
const mockLogger = OrchestratorLogger as jest.Mocked<typeof OrchestratorLogger>;

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('IncrementalSyncService', () => {
  const workspacePath = '/workspace/project';

  describe('parseStorageUri', () => {
    it('parses storage://remote:bucket/path format', () => {
      const result = IncrementalSyncService.parseStorageUri('storage://myremote:mybucket/some/path');
      expect(result).toEqual({ remote: 'myremote', path: 'mybucket/some/path' });
    });

    it('parses storage://remote/path format', () => {
      const result = IncrementalSyncService.parseStorageUri('storage://myremote/mybucket/path');
      expect(result).toEqual({ remote: 'myremote', path: 'mybucket/path' });
    });

    it('parses storage://remote:bucket with no sub-path', () => {
      const result = IncrementalSyncService.parseStorageUri('storage://myremote:mybucket');
      expect(result).toEqual({ remote: 'myremote', path: 'mybucket' });
    });

    it('handles remote-only URI without path', () => {
      const result = IncrementalSyncService.parseStorageUri('storage://myremote');
      expect(result).toEqual({ remote: 'myremote', path: '' });
    });

    it('throws on invalid URI without storage:// prefix', () => {
      expect(() => IncrementalSyncService.parseStorageUri('http://example.com')).toThrow('Invalid storage URI');
    });

    it('throws on empty URI', () => {
      expect(() => IncrementalSyncService.parseStorageUri('')).toThrow('Invalid storage URI');
    });
  });

  describe('resolveStrategy', () => {
    it('returns full when full is requested', () => {
      const result = IncrementalSyncService.resolveStrategy('full', workspacePath);
      expect(result).toBe('full');
    });

    it('returns git-delta when sync state exists', () => {
      const state: SyncState = {
        lastSyncCommit: 'abc123',
        lastSyncTimestamp: new Date().toISOString(),
        pendingOverlays: [],
      };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(state));

      const result = IncrementalSyncService.resolveStrategy('git-delta', workspacePath);
      expect(result).toBe('git-delta');
    });

    it('falls back to full when git-delta requested but no sync state', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = IncrementalSyncService.resolveStrategy('git-delta', workspacePath);
      expect(result).toBe('full');
    });

    it('returns direct-input as-is', () => {
      const result = IncrementalSyncService.resolveStrategy('direct-input', workspacePath);
      expect(result).toBe('direct-input');
    });

    it('returns storage-pull as-is', () => {
      const result = IncrementalSyncService.resolveStrategy('storage-pull', workspacePath);
      expect(result).toBe('storage-pull');
    });
  });

  describe('syncGitDelta', () => {
    const targetReference = 'def456789';

    beforeEach(() => {
      const state: SyncState = {
        lastSyncCommit: 'abc123456',
        lastSyncTimestamp: new Date().toISOString(),
        pendingOverlays: [],
      };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(state));
    });

    it('fetches and checks out changed files', async () => {
      mockSystem.Run.mockResolvedValueOnce(''); // git fetch
      mockSystem.Run.mockResolvedValueOnce('file1.txt\nfile2.cs\n'); // git diff
      mockSystem.Run.mockResolvedValueOnce(''); // git checkout

      const result = await IncrementalSyncService.syncGitDelta(workspacePath, targetReference);

      expect(result).toBe(2);
      expect(mockSystem.Run).toHaveBeenCalledWith(
        expect.stringContaining('git -C "/workspace/project" fetch origin'),
        true,
      );
      expect(mockSystem.Run).toHaveBeenCalledWith(
        expect.stringContaining('diff --name-only abc123456..def456789'),
        true,
      );
      expect(mockSystem.Run).toHaveBeenCalledWith(expect.stringContaining('checkout def456789'), true);
    });

    it('skips checkout when no files changed', async () => {
      mockSystem.Run.mockResolvedValueOnce(''); // git fetch
      mockSystem.Run.mockResolvedValueOnce(''); // git diff (empty)

      const result = await IncrementalSyncService.syncGitDelta(workspacePath, targetReference);

      expect(result).toBe(0);

      // Should only have fetch + diff calls, no checkout
      expect(mockSystem.Run).toHaveBeenCalledTimes(2);
    });

    it('throws when no sync state exists', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await expect(IncrementalSyncService.syncGitDelta(workspacePath, targetReference)).rejects.toThrow(
        'Cannot git-delta sync without existing sync state',
      );
    });

    it('saves updated sync state after delta sync', async () => {
      mockSystem.Run.mockResolvedValueOnce(''); // git fetch
      mockSystem.Run.mockResolvedValueOnce('file1.txt\n'); // git diff
      mockSystem.Run.mockResolvedValueOnce(''); // git checkout

      await IncrementalSyncService.syncGitDelta(workspacePath, targetReference);

      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writeCall = mockFs.writeFileSync.mock.calls[0];
      const savedState = JSON.parse(writeCall[1] as string) as SyncState;
      expect(savedState.lastSyncCommit).toBe(targetReference);
    });
  });

  describe('applyDirectInput', () => {
    it('extracts a local archive to workspace', async () => {
      const archivePath = '/tmp/overlay.tar';
      mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
        if (p === archivePath) return true;

        // State file path does not exist
        return false;
      });
      mockSystem.Run.mockResolvedValueOnce(''); // tar extract

      const result = await IncrementalSyncService.applyDirectInput(workspacePath, archivePath);

      expect(result).toEqual([archivePath]);
      expect(mockSystem.Run).toHaveBeenCalledWith(expect.stringContaining('tar -xf "/tmp/overlay.tar"'), true);
    });

    it('fetches archive from storage URI via rclone then extracts', async () => {
      const storageUri = 'storage://s3remote:builds/overlay.tar';

      mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
        const pathString = p.toString();
        if (pathString.includes('.game-ci-input-overlay.tar')) return true;

        return false;
      });
      mockSystem.Run.mockResolvedValue(''); // rclone copy + tar extract

      const result = await IncrementalSyncService.applyDirectInput(workspacePath, storageUri);

      expect(result.length).toBe(1);
      expect(mockSystem.Run).toHaveBeenCalledWith(
        expect.stringContaining('rclone copy "s3remote:builds/overlay.tar"'),
        true,
      );
    });

    it('throws when local archive does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await expect(IncrementalSyncService.applyDirectInput(workspacePath, '/missing/archive.tar')).rejects.toThrow(
        'Input archive not found',
      );
    });

    it('tracks overlay in sync state', async () => {
      const archivePath = '/tmp/overlay.tar';
      mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
        if (p === archivePath) return true;

        return false;
      });
      mockSystem.Run.mockResolvedValueOnce('');

      await IncrementalSyncService.applyDirectInput(workspacePath, archivePath);

      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writeCall = mockFs.writeFileSync.mock.calls[0];
      const savedState = JSON.parse(writeCall[1] as string) as SyncState;
      expect(savedState.pendingOverlays).toContain(archivePath);
    });
  });

  describe('syncStoragePull', () => {
    const storageUri = 'storage://s3:game-builds/latest';

    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(false); // no existing state
    });

    it('pulls files from rclone remote into workspace', async () => {
      mockSystem.Run.mockResolvedValueOnce('rclone v1.60.0'); // version check
      mockSystem.Run.mockResolvedValueOnce(''); // rclone copy
      mockSystem.Run.mockResolvedValueOnce('  1234 file1.txt\n  5678 dir/file2.cs\n'); // rclone ls

      const result = await IncrementalSyncService.syncStoragePull(workspacePath, storageUri);

      expect(result).toEqual(['file1.txt', 'dir/file2.cs']);
      expect(mockSystem.Run).toHaveBeenCalledWith(
        expect.stringContaining('rclone copy "s3:game-builds/latest" "/workspace/project"'),
        true,
      );
    });

    it('uses custom rclone remote when provided', async () => {
      mockSystem.Run.mockResolvedValueOnce('rclone v1.60.0'); // version
      mockSystem.Run.mockResolvedValueOnce(''); // rclone copy
      mockSystem.Run.mockResolvedValueOnce(''); // rclone ls

      await IncrementalSyncService.syncStoragePull(workspacePath, storageUri, {
        rcloneRemote: 'custom-remote',
      });

      expect(mockSystem.Run).toHaveBeenCalledWith(
        expect.stringContaining('rclone copy "custom-remote:game-builds/latest"'),
        true,
      );
    });

    it('resets workspace in clean mode before pull', async () => {
      mockSystem.Run.mockResolvedValueOnce('rclone v1.60.0'); // version
      mockSystem.Run.mockResolvedValueOnce(''); // git checkout -- .
      mockSystem.Run.mockResolvedValueOnce(''); // git clean -fd
      mockSystem.Run.mockResolvedValueOnce(''); // rclone copy
      mockSystem.Run.mockResolvedValueOnce(''); // rclone ls

      await IncrementalSyncService.syncStoragePull(workspacePath, storageUri, { cleanMode: true });

      expect(mockSystem.Run).toHaveBeenCalledWith(
        expect.stringContaining('git -C "/workspace/project" checkout -- .'),
        true,
      );
      expect(mockSystem.Run).toHaveBeenCalledWith(
        expect.stringContaining('git -C "/workspace/project" clean -fd'),
        true,
      );
    });

    it('throws on invalid storage URI', async () => {
      await expect(IncrementalSyncService.syncStoragePull(workspacePath, 'http://example.com')).rejects.toThrow(
        'Invalid storage URI',
      );
    });

    it('throws when rclone binary is not available', async () => {
      mockSystem.Run.mockRejectedValueOnce(new Error('command not found: rclone'));

      await expect(IncrementalSyncService.syncStoragePull(workspacePath, storageUri)).rejects.toThrow(
        'rclone binary not found',
      );
    });

    it('saves sync state with overlay tracking', async () => {
      mockSystem.Run.mockResolvedValueOnce('rclone v1.60.0'); // version
      mockSystem.Run.mockResolvedValueOnce(''); // rclone copy
      mockSystem.Run.mockResolvedValueOnce('  100 a.txt\n'); // rclone ls

      await IncrementalSyncService.syncStoragePull(workspacePath, storageUri);

      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writeCall = mockFs.writeFileSync.mock.calls[0];
      const savedState = JSON.parse(writeCall[1] as string) as SyncState;
      expect(savedState.pendingOverlays).toContain(storageUri);
    });

    it('handles rclone ls failure gracefully', async () => {
      mockSystem.Run.mockResolvedValueOnce('rclone v1.60.0'); // version
      mockSystem.Run.mockResolvedValueOnce(''); // rclone copy
      mockSystem.Run.mockRejectedValueOnce(new Error('ls failed')); // rclone ls fails

      const result = await IncrementalSyncService.syncStoragePull(workspacePath, storageUri);

      expect(result).toEqual([]);
      expect(mockLogger.logWarning).toHaveBeenCalledWith(expect.stringContaining('Could not list pulled files'));
    });
  });

  describe('revertOverlays', () => {
    it('reverts git state and cleans untracked files', async () => {
      const state: SyncState = {
        lastSyncCommit: 'abc123',
        lastSyncTimestamp: new Date().toISOString(),
        pendingOverlays: ['/tmp/overlay.tar', 'storage://s3:builds/content'],
      };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(state));
      mockSystem.Run.mockResolvedValue('');

      await IncrementalSyncService.revertOverlays(workspacePath);

      expect(mockSystem.Run).toHaveBeenCalledWith(
        expect.stringContaining('git -C "/workspace/project" checkout -- .'),
        true,
      );
      expect(mockSystem.Run).toHaveBeenCalledWith(
        expect.stringContaining('git -C "/workspace/project" clean -fd'),
        true,
      );
    });

    it('clears pending overlays in saved state', async () => {
      const state: SyncState = {
        lastSyncCommit: 'abc123',
        lastSyncTimestamp: new Date().toISOString(),
        pendingOverlays: ['/tmp/overlay.tar'],
      };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(state));
      mockSystem.Run.mockResolvedValue('');

      await IncrementalSyncService.revertOverlays(workspacePath);

      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writeCall = mockFs.writeFileSync.mock.calls[0];
      const savedState = JSON.parse(writeCall[1] as string) as SyncState;
      expect(savedState.pendingOverlays).toEqual([]);
    });

    it('does nothing when no overlays are pending', async () => {
      const state: SyncState = {
        lastSyncCommit: 'abc123',
        lastSyncTimestamp: new Date().toISOString(),
        pendingOverlays: [],
      };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(state));

      await IncrementalSyncService.revertOverlays(workspacePath);

      expect(mockSystem.Run).not.toHaveBeenCalled();
    });

    it('does nothing when no sync state exists', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await IncrementalSyncService.revertOverlays(workspacePath);

      expect(mockSystem.Run).not.toHaveBeenCalled();
    });
  });
});

describe('SyncStateManager', () => {
  const workspacePath = '/workspace/project';

  describe('loadState', () => {
    it('returns parsed state from default path', () => {
      const state: SyncState = {
        lastSyncCommit: 'abc123',
        lastSyncTimestamp: '2026-01-01T00:00:00.000Z',
        pendingOverlays: [],
      };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(state));

      const result = SyncStateManager.loadState(workspacePath);

      expect(result).toEqual(state);
      expect(mockFs.readFileSync).toHaveBeenCalledWith(path.join(workspacePath, '.game-ci/sync-state.json'), 'utf8');
    });

    it('uses custom state path when provided', () => {
      const state: SyncState = {
        lastSyncCommit: 'abc123',
        lastSyncTimestamp: '2026-01-01T00:00:00.000Z',
        pendingOverlays: [],
      };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(state));

      SyncStateManager.loadState(workspacePath, 'custom/state.json');

      expect(mockFs.readFileSync).toHaveBeenCalledWith(path.join(workspacePath, 'custom/state.json'), 'utf8');
    });

    it('returns undefined when state file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = SyncStateManager.loadState(workspacePath);

      expect(result).toBeUndefined();
    });

    it('returns undefined and logs warning on malformed JSON', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('not-valid-json{{{');

      const result = SyncStateManager.loadState(workspacePath);

      expect(result).toBeUndefined();
      expect(mockLogger.logWarning).toHaveBeenCalledWith(expect.stringContaining('Failed to load sync state'));
    });
  });

  describe('saveState', () => {
    it('writes state to default path with pretty JSON', () => {
      const state: SyncState = {
        lastSyncCommit: 'abc123',
        lastSyncTimestamp: '2026-01-01T00:00:00.000Z',
        pendingOverlays: ['overlay1'],
      };
      mockFs.existsSync.mockReturnValue(true);

      SyncStateManager.saveState(workspacePath, state);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(workspacePath, '.game-ci/sync-state.json'),
        JSON.stringify(state, undefined, 2),
        'utf8',
      );
    });

    it('creates parent directories if they do not exist', () => {
      const state: SyncState = {
        lastSyncCommit: 'abc123',
        lastSyncTimestamp: '2026-01-01T00:00:00.000Z',
        pendingOverlays: [],
      };
      mockFs.existsSync.mockReturnValue(false);

      SyncStateManager.saveState(workspacePath, state);

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('.game-ci'), { recursive: true });
    });

    it('logs warning on write failure instead of throwing', () => {
      const state: SyncState = {
        lastSyncCommit: 'abc123',
        lastSyncTimestamp: '2026-01-01T00:00:00.000Z',
        pendingOverlays: [],
      };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Should not throw
      SyncStateManager.saveState(workspacePath, state);

      expect(mockLogger.logWarning).toHaveBeenCalledWith(expect.stringContaining('Failed to save sync state'));
    });
  });

  describe('calculateWorkspaceHash', () => {
    it('produces a deterministic SHA-256 hash from workspace files', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation((filePath: fs.PathOrFileDescriptor) => {
        const p = filePath.toString();
        if (p.includes('ProjectVersion.txt')) return 'm_EditorVersion: 2022.3.10f1';
        if (p.includes('manifest.json')) return '{"dependencies":{}}';
        if (p.includes('packages-lock.json')) return '{"dependencies":{}}';
        if (p.includes('csc.rsp')) return '-nullable+';

        return '';
      });

      const hash1 = SyncStateManager.calculateWorkspaceHash(workspacePath);
      const hash2 = SyncStateManager.calculateWorkspaceHash(workspacePath);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex digest
    });

    it('produces different hashes for different workspace content', () => {
      let callCount = 0;
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        callCount++;

        return callCount <= 4 ? 'content-v1' : 'content-v2';
      });

      const hash1 = SyncStateManager.calculateWorkspaceHash(workspacePath);
      const hash2 = SyncStateManager.calculateWorkspaceHash(workspacePath);

      expect(hash1).not.toBe(hash2);
    });

    it('includes missing file markers in hash for absent files', () => {
      mockFs.existsSync.mockReturnValue(false);

      const hash = SyncStateManager.calculateWorkspaceHash(workspacePath);

      expect(hash).toHaveLength(64);
    });
  });

  describe('hasDrifted', () => {
    it('returns false when workspace hash matches', () => {
      mockFs.existsSync.mockReturnValue(false);
      const savedHash = SyncStateManager.calculateWorkspaceHash(workspacePath);

      const result = SyncStateManager.hasDrifted(workspacePath, savedHash);

      expect(result).toBe(false);
    });

    it('returns true when workspace hash differs', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = SyncStateManager.hasDrifted(workspacePath, 'some-old-hash-that-will-not-match');

      expect(result).toBe(true);
    });
  });
});
