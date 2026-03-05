import type { CommandModule } from 'yargs';
import * as core from '@actions/core';
import fs from 'node:fs';
import path from 'node:path';

const versionCommand: CommandModule = {
  command: 'version',
  describe: 'Show version info',
  builder: {},
  handler: async () => {
    try {
      // Read version from package.json
      let packageJsonPath = path.join(__dirname, '..', '..', '..', 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
      }
      if (!fs.existsSync(packageJsonPath)) {
        packageJsonPath = path.join(process.cwd(), 'package.json');
      }

      if (fs.existsSync(packageJsonPath)) {
        const packageData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        core.info(`game-ci (unity-builder) v${packageData.version}`);
        core.info(`Node.js ${process.version}`);
        core.info(`Platform: ${process.platform} ${process.arch}`);
      } else {
        core.info('game-ci (unity-builder)');
        core.info('Version information unavailable');
      }
    } catch (error: any) {
      core.info('game-ci (unity-builder)');
      core.error(`Could not read version: ${error.message}`);
    }
  },
};

export default versionCommand;
