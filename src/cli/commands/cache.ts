import type { CommandModule } from 'yargs';
import * as core from '@actions/core';
import fs from 'node:fs';
import path from 'node:path';

const cacheCommand: CommandModule = {
  command: 'cache <action>',
  describe: 'Manage build caches',
  builder: (yargs) => {
    return yargs
      .positional('action', {
        describe: 'Cache action to perform',
        choices: ['list', 'restore', 'clear'] as const,
      })
      .option('cache-dir', {
        alias: 'cacheDir',
        type: 'string',
        description: 'Path to the cache directory',
        default: '',
      })
      .option('project-path', {
        alias: 'projectPath',
        type: 'string',
        description: 'Path to the Unity project',
        default: '.',
      })
      .example('game-ci orchestrate cache list', 'List all cached workspaces')
      .example('game-ci orchestrate cache restore --cache-dir ./my-cache', 'Restore a cached workspace')
      .example('game-ci orchestrate cache clear', 'Clear all cached workspaces');
  },
  handler: async (cliArguments) => {
    const action = cliArguments.action as string;
    const projectPath = (cliArguments.projectPath as string) || '.';
    const cacheDirectory = (cliArguments.cacheDir as string) || path.join(projectPath, 'Library');

    try {
      switch (action) {
        case 'list': {
          await listCache(cacheDirectory, projectPath);
          break;
        }

        case 'restore': {
          await restoreCache(cacheDirectory);
          break;
        }

        case 'clear': {
          await clearCache(cacheDirectory);
          break;
        }

        default: {
          throw new Error(`Unknown cache action: ${action}. Available actions: list, restore, clear`);
        }
      }
    } catch (error: any) {
      core.setFailed(`Cache operation failed: ${error.message}`);

      throw error;
    }
  },
};

async function listCache(cacheDirectory: string, projectPath: string): Promise<void> {
  const libraryPath = path.resolve(projectPath, 'Library');

  core.info('Cache Status:');
  core.info('=============');

  if (fs.existsSync(libraryPath)) {
    const stats = fs.statSync(libraryPath);
    const files = fs.readdirSync(libraryPath);
    core.info(`  Library folder: ${libraryPath}`);
    core.info(`  Entries: ${files.length}`);
    core.info(`  Last modified: ${stats.mtime.toISOString()}`);

    // Show size of key subdirectories
    const keyDirectories = ['PackageCache', 'ScriptAssemblies', 'ShaderCache', 'Bee'];
    for (const directory of keyDirectories) {
      const directoryPath = path.join(libraryPath, directory);
      if (fs.existsSync(directoryPath)) {
        const directoryStats = fs.statSync(directoryPath);
        core.info(`  ${directory}/: exists (modified ${directoryStats.mtime.toISOString()})`);
      }
    }
  } else {
    core.info(`  Library folder not found at: ${libraryPath}`);
    core.info('  No cache available. First build will be a clean build.');
  }

  // Check for .tar cache files if a custom cache dir is specified
  if (cacheDirectory && cacheDirectory !== libraryPath && fs.existsSync(cacheDirectory)) {
    core.info(`\nCache directory: ${cacheDirectory}`);
    const cacheFiles = fs.readdirSync(cacheDirectory).filter((f) => f.endsWith('.tar') || f.endsWith('.tar.lz4'));
    if (cacheFiles.length > 0) {
      core.info(`  Cache archives found: ${cacheFiles.length}`);
      for (const file of cacheFiles) {
        const filePath = path.join(cacheDirectory, file);
        const fileStats = fs.statSync(filePath);
        const sizeMegabytes = (fileStats.size / (1024 * 1024)).toFixed(1);
        core.info(`  - ${file} (${sizeMegabytes} MB, ${fileStats.mtime.toISOString()})`);
      }
    } else {
      core.info('  No cache archives found.');
    }
  }
}

async function restoreCache(cacheDirectory: string): Promise<void> {
  if (!cacheDirectory) {
    throw new Error('--cache-dir is required for restore');
  }

  if (!fs.existsSync(cacheDirectory)) {
    core.info(`Cache directory does not exist: ${cacheDirectory}`);
    core.info('Nothing to restore.');

    return;
  }

  const cacheFiles = fs.readdirSync(cacheDirectory).filter((f) => f.endsWith('.tar') || f.endsWith('.tar.lz4'));
  if (cacheFiles.length === 0) {
    core.info('No cache archives found to restore.');

    return;
  }

  // Sort by modification time, newest first
  const sorted = cacheFiles
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(cacheDirectory, f)).mtime }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  core.info(`Found ${sorted.length} cache archive(s). Latest: ${sorted[0].name}`);
  core.info('Use the orchestrator cache system for full restore functionality:');
  core.info('  game-ci orchestrate --cache-key <key> ...');
}

async function clearCache(cacheDirectory: string): Promise<void> {
  let cleared = false;

  if (cacheDirectory && fs.existsSync(cacheDirectory)) {
    const cacheFiles = fs.readdirSync(cacheDirectory).filter((f) => f.endsWith('.tar') || f.endsWith('.tar.lz4'));
    if (cacheFiles.length > 0) {
      for (const file of cacheFiles) {
        fs.unlinkSync(path.join(cacheDirectory, file));
        core.info(`  Removed: ${file}`);
      }
      cleared = true;
    }
  }

  if (!cleared) {
    core.info('No cache archives found to clear.');
  } else {
    core.info('Cache cleared.');
  }
}

export default cacheCommand;
