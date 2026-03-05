import fs from 'node:fs';
import path from 'node:path';
import { OutputTypeRegistry, OutputTypeDefinition } from './output-type-registry';
import { OutputService } from './output-service';
import { OutputManifest } from './output-manifest';
import { ArtifactUploadHandler, ArtifactUploadConfig } from './artifact-upload-handler';

// Mock node:fs
jest.mock('node:fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

// Mock @actions/core (used by OrchestratorLogger)
jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  setOutput: jest.fn(),
  getInput: jest.fn(),
  setFailed: jest.fn(),
  setSecret: jest.fn(),
}));

// Mock @actions/exec (used by upload handler for rclone)
jest.mock('@actions/exec', () => ({
  exec: jest.fn().mockResolvedValue(0),
}));

afterEach(() => {
  jest.restoreAllMocks();
  OutputTypeRegistry.resetCustomTypes();
});

// ---------------------------------------------------------------------------
// OutputTypeRegistry Tests
// ---------------------------------------------------------------------------
describe('OutputTypeRegistry', () => {
  describe('built-in types', () => {
    it('should have 8 built-in types', () => {
      const allTypes = OutputTypeRegistry.getAllTypes();
      const builtInTypes = allTypes.filter((t) => t.builtIn);
      expect(builtInTypes).toHaveLength(8);
    });

    it.each(['build', 'test-results', 'server-build', 'data-export', 'images', 'logs', 'metrics', 'coverage'])(
      'should include built-in type "%s"',
      (typeName) => {
        const typeDef = OutputTypeRegistry.getType(typeName);
        expect(typeDef).toBeDefined();
        expect(typeDef!.name).toBe(typeName);
        expect(typeDef!.builtIn).toBe(true);
      },
    );

    it('should return undefined for unknown types', () => {
      const typeDef = OutputTypeRegistry.getType('nonexistent');
      expect(typeDef).toBeUndefined();
    });

    it('should include default paths for all built-in types', () => {
      const allTypes = OutputTypeRegistry.getAllTypes();
      for (const typeDef of allTypes) {
        expect(typeDef.defaultPath).toBeTruthy();
        expect(typeof typeDef.defaultPath).toBe('string');
      }
    });

    it('should include descriptions for all built-in types', () => {
      const allTypes = OutputTypeRegistry.getAllTypes();
      for (const typeDef of allTypes) {
        expect(typeDef.description).toBeTruthy();
        expect(typeof typeDef.description).toBe('string');
      }
    });
  });

  describe('custom type registration', () => {
    it('should register a custom type', () => {
      const customType: OutputTypeDefinition = {
        name: 'custom-reports',
        defaultPath: './Reports/',
        description: 'Custom generated reports',
        builtIn: false,
      };

      OutputTypeRegistry.registerType(customType);
      const retrieved = OutputTypeRegistry.getType('custom-reports');
      expect(retrieved).toBeDefined();
      expect(retrieved!.name).toBe('custom-reports');
      expect(retrieved!.builtIn).toBe(false);
    });

    it('should not override built-in types', () => {
      const override: OutputTypeDefinition = {
        name: 'build',
        defaultPath: './Override/',
        description: 'Should not override',
        builtIn: false,
      };

      OutputTypeRegistry.registerType(override);
      const buildType = OutputTypeRegistry.getType('build');
      expect(buildType!.defaultPath).not.toBe('./Override/');
      expect(buildType!.builtIn).toBe(true);
    });

    it('should include custom types in getAllTypes', () => {
      OutputTypeRegistry.registerType({
        name: 'custom-a',
        defaultPath: './A/',
        description: 'Custom A',
        builtIn: false,
      });

      const allTypes = OutputTypeRegistry.getAllTypes();
      expect(allTypes.length).toBe(9); // 8 built-in + 1 custom
      expect(allTypes.some((t) => t.name === 'custom-a')).toBe(true);
    });

    it('should reset custom types', () => {
      OutputTypeRegistry.registerType({
        name: 'temp-type',
        defaultPath: './Temp/',
        description: 'Temporary type',
        builtIn: false,
      });

      expect(OutputTypeRegistry.getType('temp-type')).toBeDefined();
      OutputTypeRegistry.resetCustomTypes();
      expect(OutputTypeRegistry.getType('temp-type')).toBeUndefined();
    });

    it('should force builtIn to false when registering custom types', () => {
      OutputTypeRegistry.registerType({
        name: 'sneaky',
        defaultPath: './Sneaky/',
        description: 'Tries to be built-in',
        builtIn: true, // Intentionally setting to true
      });

      const retrieved = OutputTypeRegistry.getType('sneaky');
      expect(retrieved).toBeDefined();
      expect(retrieved!.builtIn).toBe(false);
    });
  });

  describe('parseOutputTypes', () => {
    it('should parse a comma-separated string of valid types', () => {
      const types = OutputTypeRegistry.parseOutputTypes('build,logs,coverage');
      expect(types).toHaveLength(3);
      expect(types.map((t) => t.name)).toEqual(['build', 'logs', 'coverage']);
    });

    it('should skip unknown types', () => {
      const types = OutputTypeRegistry.parseOutputTypes('build,unknown,logs');
      expect(types).toHaveLength(2);
      expect(types.map((t) => t.name)).toEqual(['build', 'logs']);
    });

    it('should handle empty string', () => {
      const types = OutputTypeRegistry.parseOutputTypes('');
      expect(types).toHaveLength(0);
    });

    it('should handle whitespace in type names', () => {
      const types = OutputTypeRegistry.parseOutputTypes(' build , logs , coverage ');
      expect(types).toHaveLength(3);
    });

    it('should include custom types when parsing', () => {
      OutputTypeRegistry.registerType({
        name: 'my-reports',
        defaultPath: './Reports/',
        description: 'Custom reports',
        builtIn: false,
      });

      const types = OutputTypeRegistry.parseOutputTypes('build,my-reports');
      expect(types).toHaveLength(2);
      expect(types[1].name).toBe('my-reports');
    });
  });
});

// ---------------------------------------------------------------------------
// OutputService Tests
// ---------------------------------------------------------------------------
describe('OutputService', () => {
  const projectPath = '/project';
  const buildGuid = 'test-guid-1234';

  beforeEach(() => {
    // Reset all fs mocks
    mockedFs.existsSync.mockReset();
    mockedFs.statSync.mockReset();
    mockedFs.readdirSync.mockReset();
    mockedFs.writeFileSync.mockReset();
    mockedFs.mkdirSync.mockReset();
  });

  describe('collectOutputs', () => {
    it('should return an empty manifest when no output types are declared', async () => {
      const manifest = await OutputService.collectOutputs(projectPath, buildGuid, '');
      expect(manifest.buildGuid).toBe(buildGuid);
      expect(manifest.outputs).toHaveLength(0);
      expect(manifest.timestamp).toBeTruthy();
    });

    it('should skip outputs where the path does not exist', async () => {
      mockedFs.existsSync.mockReturnValue(false);

      const manifest = await OutputService.collectOutputs(projectPath, buildGuid, 'build,logs');
      expect(manifest.outputs).toHaveLength(0);
    });

    it('should collect directory outputs with file listings', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.statSync.mockReturnValue({ isDirectory: () => true, size: 0 } as any);
      mockedFs.readdirSync.mockImplementation((_dirPath: any, options?: any) => {
        if (options?.withFileTypes) {
          return [
            { name: 'file1.txt', isDirectory: () => false },
            { name: 'file2.txt', isDirectory: () => false },
          ] as any;
        }

        return ['file1.txt', 'file2.txt'] as any;
      });

      const manifest = await OutputService.collectOutputs(projectPath, buildGuid, 'logs');
      expect(manifest.outputs).toHaveLength(1);
      expect(manifest.outputs[0].type).toBe('logs');
      expect(manifest.outputs[0].files).toEqual(['file1.txt', 'file2.txt']);
    });

    it('should collect file output with correct size', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.statSync.mockReturnValue({ isDirectory: () => false, size: 4096 } as any);

      const manifest = await OutputService.collectOutputs(projectPath, buildGuid, 'coverage');
      expect(manifest.outputs).toHaveLength(1);
      expect(manifest.outputs[0].size).toBe(4096);
    });

    it('should write manifest to disk when manifestPath is provided', async () => {
      // existsSync returns false for output paths (no outputs found) but mkdirSync/writeFileSync should still be called
      // The service only writes manifest when at least one output type is declared and types are resolved
      // So we need to provide a valid output type and have its path exist
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.statSync.mockReturnValue({ isDirectory: () => false, size: 100 } as any);
      mockedFs.mkdirSync.mockReturnValue(undefined);
      mockedFs.writeFileSync.mockImplementation(() => {});

      const manifestPath = '/output/manifest.json';
      await OutputService.collectOutputs(projectPath, buildGuid, 'logs', manifestPath);

      expect(mockedFs.mkdirSync).toHaveBeenCalledWith(path.dirname(manifestPath), { recursive: true });
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(manifestPath, expect.any(String), 'utf8');
    });

    it('should generate valid JSON in the manifest file', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.statSync.mockReturnValue({ isDirectory: () => false, size: 200 } as any);
      mockedFs.mkdirSync.mockReturnValue(undefined);
      mockedFs.writeFileSync.mockImplementation(() => {});

      const manifestPath = '/output/manifest.json';
      await OutputService.collectOutputs(projectPath, buildGuid, 'coverage', manifestPath);

      const writtenContent = (mockedFs.writeFileSync as jest.Mock).mock.calls[0][1];
      const parsed = JSON.parse(writtenContent);
      expect(parsed.buildGuid).toBe(buildGuid);
      expect(Array.isArray(parsed.outputs)).toBe(true);
      expect(parsed.outputs.length).toBeGreaterThan(0);
    });

    it('should set a valid ISO 8601 timestamp', async () => {
      const manifest = await OutputService.collectOutputs(projectPath, buildGuid, '');
      const parsed = new Date(manifest.timestamp);
      expect(parsed.toISOString()).toBe(manifest.timestamp);
    });
  });
});

// ---------------------------------------------------------------------------
// ArtifactUploadHandler Tests
// ---------------------------------------------------------------------------
describe('ArtifactUploadHandler', () => {
  const projectPath = '/project';

  beforeEach(() => {
    mockedFs.existsSync.mockReset();
    mockedFs.statSync.mockReset();
    mockedFs.readdirSync.mockReset();
    mockedFs.mkdirSync.mockReset();
    mockedFs.copyFileSync.mockReset();
  });

  describe('parseConfig', () => {
    it('should parse valid config values', () => {
      const config = ArtifactUploadHandler.parseConfig('github-artifacts', '/dest', 'gzip', '14');
      expect(config.target).toBe('github-artifacts');
      expect(config.destination).toBe('/dest');
      expect(config.compression).toBe('gzip');
      expect(config.retentionDays).toBe(14);
    });

    it('should default invalid target to github-artifacts', () => {
      const config = ArtifactUploadHandler.parseConfig('invalid', undefined, 'none', '30');
      expect(config.target).toBe('github-artifacts');
    });

    it('should default invalid compression to gzip', () => {
      const config = ArtifactUploadHandler.parseConfig('local', '/dest', 'brotli', '30');
      expect(config.compression).toBe('gzip');
    });

    it('should default invalid retention to 30 days', () => {
      const config = ArtifactUploadHandler.parseConfig('local', '/dest', 'gzip', 'abc');
      expect(config.retentionDays).toBe(30);
    });

    it('should default negative retention to 30 days', () => {
      const config = ArtifactUploadHandler.parseConfig('local', '/dest', 'gzip', '-5');
      expect(config.retentionDays).toBe(30);
    });

    it('should set destination to undefined when empty string', () => {
      const config = ArtifactUploadHandler.parseConfig('storage', '', 'none', '7');
      expect(config.destination).toBeUndefined();
    });
  });

  describe('uploadArtifacts', () => {
    it('should skip upload when target is none', async () => {
      const manifest: OutputManifest = {
        buildGuid: 'test-guid',
        timestamp: new Date().toISOString(),
        outputs: [{ type: 'build', path: './Builds/' }],
      };

      const config: ArtifactUploadConfig = {
        target: 'none',
        compression: 'gzip',
        retentionDays: 30,
      };

      const result = await ArtifactUploadHandler.uploadArtifacts(manifest, config, projectPath);
      expect(result.success).toBe(true);
      expect(result.entries).toHaveLength(0);
    });

    it('should return success with no entries for empty manifest', async () => {
      const manifest: OutputManifest = {
        buildGuid: 'test-guid',
        timestamp: new Date().toISOString(),
        outputs: [],
      };

      const config: ArtifactUploadConfig = {
        target: 'github-artifacts',
        compression: 'gzip',
        retentionDays: 30,
      };

      const result = await ArtifactUploadHandler.uploadArtifacts(manifest, config, projectPath);
      expect(result.success).toBe(true);
      expect(result.entries).toHaveLength(0);
      expect(result.totalBytes).toBe(0);
    });

    it('should fail entry when output path does not exist', async () => {
      mockedFs.existsSync.mockReturnValue(false);

      const manifest: OutputManifest = {
        buildGuid: 'test-guid',
        timestamp: new Date().toISOString(),
        outputs: [{ type: 'build', path: './Builds/Missing/' }],
      };

      const config: ArtifactUploadConfig = {
        target: 'local',
        destination: '/output',
        compression: 'none',
        retentionDays: 30,
      };

      const result = await ArtifactUploadHandler.uploadArtifacts(manifest, config, projectPath);
      expect(result.success).toBe(false);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].success).toBe(false);
      expect(result.entries[0].error).toContain('does not exist');
    });

    it('should copy files for local upload target', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.statSync.mockReturnValue({ isDirectory: () => false, size: 1024 } as any);
      mockedFs.mkdirSync.mockReturnValue(undefined);
      mockedFs.copyFileSync.mockReturnValue(undefined);

      const manifest: OutputManifest = {
        buildGuid: 'test-guid',
        timestamp: new Date().toISOString(),
        outputs: [{ type: 'logs', path: './Logs/build.log', size: 1024 }],
      };

      const config: ArtifactUploadConfig = {
        target: 'local',
        destination: '/output',
        compression: 'none',
        retentionDays: 30,
      };

      const result = await ArtifactUploadHandler.uploadArtifacts(manifest, config, projectPath);
      expect(result.success).toBe(true);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].success).toBe(true);
      expect(result.totalBytes).toBe(1024);
    });

    it('should fail local upload when no destination is provided', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.statSync.mockReturnValue({ isDirectory: () => false, size: 512 } as any);

      const manifest: OutputManifest = {
        buildGuid: 'test-guid',
        timestamp: new Date().toISOString(),
        outputs: [{ type: 'logs', path: './Logs/build.log', size: 512 }],
      };

      const config: ArtifactUploadConfig = {
        target: 'local',
        compression: 'none',
        retentionDays: 30,
      };

      const result = await ArtifactUploadHandler.uploadArtifacts(manifest, config, projectPath);
      expect(result.success).toBe(false);
      expect(result.entries[0].success).toBe(false);
      expect(result.entries[0].error).toContain('destination path');
    });

    it('should report correct duration', async () => {
      const manifest: OutputManifest = {
        buildGuid: 'test-guid',
        timestamp: new Date().toISOString(),
        outputs: [],
      };

      const config: ArtifactUploadConfig = {
        target: 'none',
        compression: 'gzip',
        retentionDays: 30,
      };

      const result = await ArtifactUploadHandler.uploadArtifacts(manifest, config, projectPath);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('collectFiles', () => {
    it('should return single file for a file path', () => {
      mockedFs.statSync.mockReturnValue({ isDirectory: () => false } as any);

      const files = ArtifactUploadHandler.collectFiles('/path/to/file.txt');
      expect(files).toEqual(['/path/to/file.txt']);
    });

    it('should return all files recursively for a directory', () => {
      mockedFs.statSync.mockImplementation((p: any) => {
        const pathStr = typeof p === 'string' ? p : p.toString();
        if (pathStr.endsWith('.txt') || pathStr.endsWith('.log')) {
          return { isDirectory: () => false } as any;
        }

        return { isDirectory: () => true } as any;
      });

      mockedFs.readdirSync.mockImplementation((dirPath: any, _options?: any) => {
        const dirStr = typeof dirPath === 'string' ? dirPath : dirPath.toString();
        if (dirStr === '/root') {
          return [
            { name: 'file1.txt', isDirectory: () => false },
            { name: 'sub', isDirectory: () => true },
          ] as any;
        }
        if (dirStr.endsWith('sub')) {
          return [{ name: 'file2.log', isDirectory: () => false }] as any;
        }

        return [] as any;
      });

      const files = ArtifactUploadHandler.collectFiles('/root');
      expect(files).toHaveLength(2);
      expect(files).toContain(path.join('/root', 'file1.txt'));
      expect(files).toContain(path.join('/root', 'sub', 'file2.log'));
    });
  });

  describe('storage upload validation', () => {
    it('should fail storage upload when no destination is provided', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.statSync.mockReturnValue({ isDirectory: () => false, size: 256 } as any);

      const manifest: OutputManifest = {
        buildGuid: 'test-guid',
        timestamp: new Date().toISOString(),
        outputs: [{ type: 'build', path: './Builds/', size: 256 }],
      };

      const config: ArtifactUploadConfig = {
        target: 'storage',
        compression: 'gzip',
        retentionDays: 30,
      };

      const result = await ArtifactUploadHandler.uploadArtifacts(manifest, config, projectPath);
      expect(result.success).toBe(false);
      expect(result.entries[0].error).toContain('destination URI');
    });

    it('should fail storage upload when destination URI has invalid format', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.statSync.mockReturnValue({ isDirectory: () => false, size: 256 } as any);

      const manifest: OutputManifest = {
        buildGuid: 'test-guid',
        timestamp: new Date().toISOString(),
        outputs: [{ type: 'build', path: './Builds/', size: 256 }],
      };

      const config: ArtifactUploadConfig = {
        target: 'storage',
        destination: '/just/a/local/path',
        compression: 'gzip',
        retentionDays: 30,
      };

      const result = await ArtifactUploadHandler.uploadArtifacts(manifest, config, projectPath);
      expect(result.success).toBe(false);
      expect(result.entries[0].error).toContain('Invalid storage destination URI');
    });

    it('should fail storage upload when rclone is not installed', async () => {
      // Mock child_process.execFileSync to throw (rclone not found)
      const childProcess = require('node:child_process');
      const originalExecFileSync = childProcess.execFileSync;
      childProcess.execFileSync = jest.fn(() => {
        throw new Error('ENOENT');
      });

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.statSync.mockReturnValue({ isDirectory: () => false, size: 256 } as any);

      const manifest: OutputManifest = {
        buildGuid: 'test-guid',
        timestamp: new Date().toISOString(),
        outputs: [{ type: 'build', path: './Builds/', size: 256 }],
      };

      const config: ArtifactUploadConfig = {
        target: 'storage',
        destination: 's3:my-bucket/artifacts',
        compression: 'gzip',
        retentionDays: 30,
      };

      const result = await ArtifactUploadHandler.uploadArtifacts(manifest, config, projectPath);
      expect(result.success).toBe(false);
      expect(result.entries[0].error).toContain('rclone is not installed');

      // Restore
      childProcess.execFileSync = originalExecFileSync;
    });

    it('should accept valid rclone storage URI formats', async () => {
      // Mock child_process.execFileSync to succeed (rclone available)
      const childProcess = require('node:child_process');
      const originalExecFileSync = childProcess.execFileSync;
      childProcess.execFileSync = jest.fn(() => 'rclone v1.65.0');

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.statSync.mockReturnValue({ isDirectory: () => false, size: 256 } as any);

      const manifest: OutputManifest = {
        buildGuid: 'test-guid',
        timestamp: new Date().toISOString(),
        outputs: [{ type: 'build', path: './Builds/', size: 256 }],
      };

      // s3:bucket format should pass URI validation and reach the exec call
      const config: ArtifactUploadConfig = {
        target: 'storage',
        destination: 's3:my-bucket/artifacts',
        compression: 'gzip',
        retentionDays: 30,
      };

      const result = await ArtifactUploadHandler.uploadArtifacts(manifest, config, projectPath);
      // Should succeed because exec is mocked to return 0
      expect(result.entries[0].success).toBe(true);

      // Restore
      childProcess.execFileSync = originalExecFileSync;
    });
  });
});
