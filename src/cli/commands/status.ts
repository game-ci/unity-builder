import type { CommandModule } from 'yargs';
import * as core from '@actions/core';
import fs from 'node:fs';
import path from 'node:path';
import UnityVersioning from '../../model/unity-versioning';

const statusCommand: CommandModule = {
  command: 'status',
  describe: 'Show build status and workspace info',
  builder: (yargs) => {
    return yargs.option('project-path', {
      alias: 'projectPath',
      type: 'string',
      description: 'Path to the Unity project',
      default: '.',
    });
  },
  handler: async (cliArguments) => {
    const projectPath = (cliArguments.projectPath as string) || '.';

    core.info('game-ci Workspace Status');
    core.info('========================\n');

    // Project detection
    const projectVersionPath = path.join(projectPath, 'ProjectSettings', 'ProjectVersion.txt');
    const hasProject = fs.existsSync(projectVersionPath);

    core.info(`Project Path: ${path.resolve(projectPath)}`);
    core.info(`Unity Project Found: ${hasProject ? 'Yes' : 'No'}`);

    if (hasProject) {
      try {
        const unityVersion = UnityVersioning.determineUnityVersion(projectPath, 'auto');
        core.info(`Unity Version: ${unityVersion}`);
      } catch {
        core.info(`Unity Version: Unable to detect`);
      }

      // Library folder status
      const libraryPath = path.join(projectPath, 'Library');
      if (fs.existsSync(libraryPath)) {
        const stats = fs.statSync(libraryPath);
        core.info(`Library Cache: Present (modified ${stats.mtime.toISOString()})`);
      } else {
        core.info(`Library Cache: Not present (clean build required)`);
      }

      // Build output detection
      const buildsPath = path.join(projectPath, '..', 'build');
      if (fs.existsSync(buildsPath)) {
        const builds = fs.readdirSync(buildsPath);
        if (builds.length > 0) {
          core.info(`\nBuild Outputs (${buildsPath}):`);
          for (const build of builds) {
            const buildPath = path.join(buildsPath, build);
            const buildStats = fs.statSync(buildPath);
            core.info(`  - ${build} (${buildStats.isDirectory() ? 'dir' : 'file'}, ${buildStats.mtime.toISOString()})`);
          }
        }
      }
    }

    // Environment
    core.info('\nEnvironment:');
    core.info(`  Platform: ${process.platform}`);
    core.info(`  Node.js: ${process.version}`);
    core.info(`  UNITY_SERIAL: ${process.env.UNITY_SERIAL ? 'Set' : 'Not set'}`);
    core.info(`  UNITY_LICENSE: ${process.env.UNITY_LICENSE ? 'Set' : 'Not set'}`);
    core.info(`  UNITY_EMAIL: ${process.env.UNITY_EMAIL ? 'Set' : 'Not set'}`);
    core.info(`  UNITY_PASSWORD: ${process.env.UNITY_PASSWORD ? 'Set' : 'Not set'}`);

    // Docker availability
    core.info(`\nDocker: Checking...`);
    try {
      const { execSync } = await import('node:child_process');
      const dockerVersion = execSync('docker --version', { encoding: 'utf8' }).trim();
      core.info(`  ${dockerVersion}`);
    } catch {
      core.info(`  Docker not found or not accessible`);
    }
  },
};

export default statusCommand;
