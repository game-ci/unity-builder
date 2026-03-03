import { assert } from 'node:console';
import fs from 'node:fs';
import path from 'node:path';
import CloudRunner from '../cloud-runner';
import CloudRunnerLogger from '../services/core/cloud-runner-logger';
import { CloudRunnerFolders } from '../options/cloud-runner-folders';
import { CloudRunnerSystem } from '../services/core/cloud-runner-system';
import { LfsHashing } from '../services/utility/lfs-hashing';
import { RemoteClientLogger } from './remote-client-logger';
import { Cli } from '../../cli/cli';
import { CliFunction } from '../../cli/cli-functions-repository';
// eslint-disable-next-line github/no-then
const fileExists = async (fpath: fs.PathLike) => !!(await fs.promises.stat(fpath).catch(() => false));

export class Caching {
  @CliFunction(`cache-push`, `push to cache`)
  static async cachePush() {
    try {
      const buildParameter = JSON.parse(process.env.BUILD_PARAMETERS || '{}');
      CloudRunner.buildParameters = buildParameter;
      await Caching.PushToCache(
        Cli.options!['cachePushTo'],
        Cli.options!['cachePushFrom'],
        Cli.options!['artifactName'] || '',
      );
    } catch (error: any) {
      CloudRunnerLogger.log(`${error}`);
    }
  }

  @CliFunction(`cache-pull`, `pull from cache`)
  static async cachePull() {
    try {
      const buildParameter = JSON.parse(process.env.BUILD_PARAMETERS || '{}');
      CloudRunner.buildParameters = buildParameter;
      await Caching.PullFromCache(
        Cli.options!['cachePushFrom'],
        Cli.options!['cachePushTo'],
        Cli.options!['artifactName'] || '',
      );
    } catch (error: any) {
      CloudRunnerLogger.log(`${error}`);
    }
  }

  public static async PushToCache(cacheFolder: string, sourceFolder: string, cacheArtifactName: string) {
    CloudRunnerLogger.log(`Pushing to cache ${sourceFolder}`);
    cacheArtifactName = cacheArtifactName.replace(' ', '');
    const startPath = process.cwd();
    let compressionSuffix = '';
    if (CloudRunner.buildParameters.useCompressionStrategy === true) {
      compressionSuffix = `.lz4`;
    }
    CloudRunnerLogger.log(`Compression: ${CloudRunner.buildParameters.useCompressionStrategy} ${compressionSuffix}`);
    try {
      if (!(await fileExists(cacheFolder))) {
        await CloudRunnerSystem.Run(`mkdir -p ${cacheFolder}`);
      }
      process.chdir(path.resolve(sourceFolder, '..'));

      if (CloudRunner.buildParameters.cloudRunnerDebug === true) {
        CloudRunnerLogger.log(
          `Hashed cache folder ${await LfsHashing.hashAllFiles(sourceFolder)} ${sourceFolder} ${path.basename(
            sourceFolder,
          )}`,
        );
      }
      const contents = await fs.promises.readdir(path.basename(sourceFolder));
      CloudRunnerLogger.log(
        `There is ${contents.length} files/dir in the source folder ${path.basename(sourceFolder)}`,
      );

      if (contents.length === 0) {
        CloudRunnerLogger.log(
          `Did not push source folder to cache because it was empty ${path.basename(sourceFolder)}`,
        );
        process.chdir(`${startPath}`);

        return;
      }

      // Check disk space before creating tar archive and clean up if needed
      let diskUsagePercent = 0;
      try {
        const diskCheckOutput = await CloudRunnerSystem.Run(`df . 2>/dev/null || df /data 2>/dev/null || true`);
        CloudRunnerLogger.log(`Disk space before tar: ${diskCheckOutput}`);

        // Parse disk usage percentage (e.g., "72G  72G  196M 100%")
        const usageMatch = diskCheckOutput.match(/(\d+)%/);
        if (usageMatch) {
          diskUsagePercent = Number.parseInt(usageMatch[1], 10);
        }
      } catch {
        // Ignore disk check errors
      }

      // If disk usage is high (>90%), proactively clean up old cache files
      if (diskUsagePercent > 90) {
        CloudRunnerLogger.log(`Disk usage is ${diskUsagePercent}% - cleaning up old cache files before tar operation`);
        try {
          const cacheParent = path.dirname(cacheFolder);
          if (await fileExists(cacheParent)) {
            // Try to fix permissions first to avoid permission denied errors
            await CloudRunnerSystem.Run(
              `chmod -R u+w ${cacheParent} 2>/dev/null || chown -R $(whoami) ${cacheParent} 2>/dev/null || true`,
            );

            // Remove cache files older than 6 hours (more aggressive than 1 day)
            // Use multiple methods to handle permission issues
            await CloudRunnerSystem.Run(
              `find ${cacheParent} -name "*.tar*" -type f -mmin +360 -delete 2>/dev/null || true`,
            );

            // Try with sudo if available
            await CloudRunnerSystem.Run(
              `sudo find ${cacheParent} -name "*.tar*" -type f -mmin +360 -delete 2>/dev/null || true`,
            );

            // As last resort, try to remove files one by one
            await CloudRunnerSystem.Run(
              `find ${cacheParent} -name "*.tar*" -type f -mmin +360 -exec rm -f {} + 2>/dev/null || true`,
            );

            // Also try to remove old cache directories
            await CloudRunnerSystem.Run(`find ${cacheParent} -type d -empty -delete 2>/dev/null || true`);

            // If disk is still very high (>95%), be even more aggressive
            if (diskUsagePercent > 95) {
              CloudRunnerLogger.log(`Disk usage is very high (${diskUsagePercent}%), performing aggressive cleanup...`);

              // Remove files older than 1 hour
              await CloudRunnerSystem.Run(
                `find ${cacheParent} -name "*.tar*" -type f -mmin +60 -delete 2>/dev/null || true`,
              );
              await CloudRunnerSystem.Run(
                `sudo find ${cacheParent} -name "*.tar*" -type f -mmin +60 -delete 2>/dev/null || true`,
              );
            }

            CloudRunnerLogger.log(`Cleanup completed. Checking disk space again...`);
            const diskCheckAfter = await CloudRunnerSystem.Run(`df . 2>/dev/null || df /data 2>/dev/null || true`);
            CloudRunnerLogger.log(`Disk space after cleanup: ${diskCheckAfter}`);

            // Check disk usage again after cleanup
            let diskUsageAfterCleanup = 0;
            try {
              const usageMatchAfter = diskCheckAfter.match(/(\d+)%/);
              if (usageMatchAfter) {
                diskUsageAfterCleanup = Number.parseInt(usageMatchAfter[1], 10);
              }
            } catch {
              // Ignore parsing errors
            }

            // If disk is still at 100% after cleanup, skip tar operation to prevent hang.
            // Do NOT fail the build here – it's better to skip caching than to fail the job
            // due to shared CI disk pressure.
            if (diskUsageAfterCleanup >= 100) {
              const message = `Cannot create cache archive: disk is still at ${diskUsageAfterCleanup}% after cleanup. Tar operation would hang. Skipping cache push; please free up disk space manually if this persists.`;
              CloudRunnerLogger.logWarning(message);
              RemoteClientLogger.log(message);

              // Restore working directory before early return
              process.chdir(`${startPath}`);

              return;
            }
          }
        } catch (cleanupError) {
          // If cleanupError is our disk space error, rethrow it
          if (cleanupError instanceof Error && cleanupError.message.includes('Cannot create cache archive')) {
            throw cleanupError;
          }
          CloudRunnerLogger.log(`Proactive cleanup failed: ${cleanupError}`);
        }
      }

      // Clean up any existing incomplete tar files
      try {
        await CloudRunnerSystem.Run(`rm -f ${cacheArtifactName}.tar${compressionSuffix} 2>/dev/null || true`);
      } catch {
        // Ignore cleanup errors
      }

      try {
        // Add timeout to tar command to prevent hanging when disk is full
        // Use timeout command with 10 minute limit (600 seconds) if available
        // Check if timeout command exists, otherwise use regular tar
        const tarCommand = `tar -cf ${cacheArtifactName}.tar${compressionSuffix} "${path.basename(sourceFolder)}"`;
        let tarCommandToRun = tarCommand;
        try {
          // Check if timeout command is available
          await CloudRunnerSystem.Run(`which timeout > /dev/null 2>&1`, true, true);

          // Use timeout if available (600 seconds = 10 minutes)
          tarCommandToRun = `timeout 600 ${tarCommand}`;
        } catch {
          // timeout command not available, use regular tar
          // Note: This could still hang if disk is full, but the disk space check above should prevent this
          tarCommandToRun = tarCommand;
        }

        await CloudRunnerSystem.Run(tarCommandToRun);
      } catch (error: any) {
        // Check if error is due to disk space or timeout
        const errorMessage = error?.message || error?.toString() || '';
        if (
          errorMessage.includes('No space left') ||
          errorMessage.includes('Wrote only') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('Terminated')
        ) {
          CloudRunnerLogger.log(`Disk space error detected. Attempting aggressive cleanup...`);

          // Try to clean up old cache files more aggressively
          try {
            const cacheParent = path.dirname(cacheFolder);
            if (await fileExists(cacheParent)) {
              // Try to fix permissions first to avoid permission denied errors
              await CloudRunnerSystem.Run(
                `chmod -R u+w ${cacheParent} 2>/dev/null || chown -R $(whoami) ${cacheParent} 2>/dev/null || true`,
              );

              // Remove cache files older than 1 hour (very aggressive)
              // Use multiple methods to handle permission issues
              await CloudRunnerSystem.Run(
                `find ${cacheParent} -name "*.tar*" -type f -mmin +60 -delete 2>/dev/null || true`,
              );
              await CloudRunnerSystem.Run(
                `sudo find ${cacheParent} -name "*.tar*" -type f -mmin +60 -delete 2>/dev/null || true`,
              );

              // As last resort, try to remove files one by one
              await CloudRunnerSystem.Run(
                `find ${cacheParent} -name "*.tar*" -type f -mmin +60 -exec rm -f {} + 2>/dev/null || true`,
              );

              // Remove empty cache directories
              await CloudRunnerSystem.Run(`find ${cacheParent} -type d -empty -delete 2>/dev/null || true`);

              // Also try to clean up the entire cache folder if it's getting too large
              const cacheRoot = path.resolve(cacheParent, '..');
              if (await fileExists(cacheRoot)) {
                // Try to fix permissions for cache root too
                await CloudRunnerSystem.Run(
                  `chmod -R u+w ${cacheRoot} 2>/dev/null || chown -R $(whoami) ${cacheRoot} 2>/dev/null || true`,
                );

                // Remove cache entries older than 30 minutes
                await CloudRunnerSystem.Run(
                  `find ${cacheRoot} -name "*.tar*" -type f -mmin +30 -delete 2>/dev/null || true`,
                );
                await CloudRunnerSystem.Run(
                  `sudo find ${cacheRoot} -name "*.tar*" -type f -mmin +30 -delete 2>/dev/null || true`,
                );
              }
              CloudRunnerLogger.log(`Aggressive cleanup completed. Retrying tar operation...`);

              // Retry the tar operation once after cleanup
              let retrySucceeded = false;
              try {
                await CloudRunnerSystem.Run(
                  `tar -cf ${cacheArtifactName}.tar${compressionSuffix} "${path.basename(sourceFolder)}"`,
                );

                // If retry succeeds, mark it - we'll continue normally without throwing
                retrySucceeded = true;
              } catch (retryError: any) {
                throw new Error(
                  `Failed to create cache archive after cleanup. Original error: ${errorMessage}. Retry error: ${
                    retryError?.message || retryError
                  }`,
                );
              }

              // If retry succeeded, don't throw the original error - let execution continue after catch block
              if (!retrySucceeded) {
                throw error;
              }

              // If we get here, retry succeeded - execution will continue after the catch block
            } else {
              throw new Error(
                `Failed to create cache archive due to insufficient disk space. Error: ${errorMessage}. Cleanup not possible - cache folder missing.`,
              );
            }
          } catch (cleanupError: any) {
            CloudRunnerLogger.log(`Cleanup attempt failed: ${cleanupError}`);
            throw new Error(
              `Failed to create cache archive due to insufficient disk space. Error: ${errorMessage}. Cleanup failed: ${
                cleanupError?.message || cleanupError
              }`,
            );
          }
        } else {
          throw error;
        }
      }
      await CloudRunnerSystem.Run(`du ${cacheArtifactName}.tar${compressionSuffix}`);
      assert(await fileExists(`${cacheArtifactName}.tar${compressionSuffix}`), 'cache archive exists');
      assert(await fileExists(path.basename(sourceFolder)), 'source folder exists');

      // Ensure the cache folder directory exists before moving the file
      // (it might have been deleted by cleanup if it was empty)
      if (!(await fileExists(cacheFolder))) {
        await CloudRunnerSystem.Run(`mkdir -p ${cacheFolder}`);
      }
      await CloudRunnerSystem.Run(`mv ${cacheArtifactName}.tar${compressionSuffix} ${cacheFolder}`);
      RemoteClientLogger.log(`moved cache entry ${cacheArtifactName} to ${cacheFolder}`);
      assert(
        await fileExists(`${path.join(cacheFolder, cacheArtifactName)}.tar${compressionSuffix}`),
        'cache archive exists inside cache folder',
      );
    } catch (error) {
      process.chdir(`${startPath}`);
      throw error;
    }
    process.chdir(`${startPath}`);
  }
  public static async PullFromCache(cacheFolder: string, destinationFolder: string, cacheArtifactName: string = ``) {
    CloudRunnerLogger.log(`Pulling from cache ${destinationFolder} ${CloudRunner.buildParameters.skipCache}`);
    if (`${CloudRunner.buildParameters.skipCache}` === `true`) {
      CloudRunnerLogger.log(`Skipping cache debugSkipCache is true`);

      return;
    }
    cacheArtifactName = cacheArtifactName.replace(' ', '');
    let compressionSuffix = '';
    if (CloudRunner.buildParameters.useCompressionStrategy === true) {
      compressionSuffix = `.lz4`;
    }
    const startPath = process.cwd();
    RemoteClientLogger.log(`Caching for (lz4 ${compressionSuffix}) ${path.basename(destinationFolder)}`);
    try {
      if (!(await fileExists(cacheFolder))) {
        await fs.promises.mkdir(cacheFolder);
      }

      if (!(await fileExists(destinationFolder))) {
        await fs.promises.mkdir(destinationFolder);
      }

      const latestInBranch = await (
        await CloudRunnerSystem.Run(`ls -t "${cacheFolder}" | grep .tar${compressionSuffix}$ | head -1`)
      )
        .replace(/\n/g, ``)
        .replace(`.tar${compressionSuffix}`, '');

      process.chdir(cacheFolder);

      const cacheSelection =
        cacheArtifactName !== `` && (await fileExists(`${cacheArtifactName}.tar${compressionSuffix}`))
          ? cacheArtifactName
          : latestInBranch;
      await CloudRunnerLogger.log(`cache key ${cacheArtifactName} selection ${cacheSelection}`);

      if (await fileExists(`${cacheSelection}.tar${compressionSuffix}`)) {
        // Check disk space before extraction to prevent hangs
        let diskUsagePercent = 0;
        try {
          const diskCheckOutput = await CloudRunnerSystem.Run(`df . 2>/dev/null || df /data 2>/dev/null || true`);
          const usageMatch = diskCheckOutput.match(/(\d+)%/);
          if (usageMatch) {
            diskUsagePercent = Number.parseInt(usageMatch[1], 10);
          }
        } catch {
          // Ignore disk check errors
        }

        // If disk is at 100%, skip cache extraction to prevent hangs
        if (diskUsagePercent >= 100) {
          const message = `Disk is at ${diskUsagePercent}% - skipping cache extraction to prevent hang. Cache may be incomplete or corrupted.`;
          CloudRunnerLogger.logWarning(message);
          RemoteClientLogger.logWarning(message);

          // Continue without cache - build will proceed without cached Library
          process.chdir(startPath);

          return;
        }

        // Validate tar file integrity before extraction
        try {
          // Use tar -t to test the archive without extracting (fast check)
          // This will fail if the archive is corrupted
          await CloudRunnerSystem.Run(
            `tar -tf ${cacheSelection}.tar${compressionSuffix} > /dev/null 2>&1 || (echo "Tar file validation failed" && exit 1)`,
          );
        } catch {
          const message = `Cache archive ${cacheSelection}.tar${compressionSuffix} appears to be corrupted or incomplete. Skipping cache extraction.`;
          CloudRunnerLogger.logWarning(message);
          RemoteClientLogger.logWarning(message);

          // Continue without cache - build will proceed without cached Library
          process.chdir(startPath);

          return;
        }

        const resultsFolder = `results${CloudRunner.buildParameters.buildGuid}`;
        await CloudRunnerSystem.Run(`mkdir -p ${resultsFolder}`);
        RemoteClientLogger.log(`cache item exists ${cacheFolder}/${cacheSelection}.tar${compressionSuffix}`);
        const fullResultsFolder = path.join(cacheFolder, resultsFolder);

        // Extract with timeout to prevent infinite hangs
        try {
          let tarExtractCommand = `tar -xf ${cacheSelection}.tar${compressionSuffix} -C ${fullResultsFolder}`;

          // Add timeout if available (600 seconds = 10 minutes)
          try {
            await CloudRunnerSystem.Run(`which timeout > /dev/null 2>&1`, true, true);
            tarExtractCommand = `timeout 600 ${tarExtractCommand}`;
          } catch {
            // timeout command not available, use regular tar
          }

          await CloudRunnerSystem.Run(tarExtractCommand);
        } catch (extractError: any) {
          const errorMessage = extractError?.message || extractError?.toString() || '';

          // Check for common tar errors that indicate corruption or disk issues
          if (
            errorMessage.includes('Unexpected EOF') ||
            errorMessage.includes('rmtlseek') ||
            errorMessage.includes('No space left') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('Terminated')
          ) {
            const message = `Cache extraction failed (likely due to corrupted archive or disk space): ${errorMessage}. Continuing without cache.`;
            CloudRunnerLogger.logWarning(message);
            RemoteClientLogger.logWarning(message);

            // Continue without cache - build will proceed without cached Library
            process.chdir(startPath);

            return;
          }

          // Re-throw other errors
          throw extractError;
        }

        RemoteClientLogger.log(`cache item extracted to ${fullResultsFolder}`);
        assert(await fileExists(fullResultsFolder), `cache extraction results folder exists`);
        const destinationParentFolder = path.resolve(destinationFolder, '..');

        if (await fileExists(destinationFolder)) {
          await fs.promises.rmdir(destinationFolder, { recursive: true });
        }
        await CloudRunnerSystem.Run(
          `mv "${path.join(fullResultsFolder, path.basename(destinationFolder))}" "${destinationParentFolder}"`,
        );
        const contents = await fs.promises.readdir(
          path.join(destinationParentFolder, path.basename(destinationFolder)),
        );
        CloudRunnerLogger.log(
          `There is ${contents.length} files/dir in the cache pulled contents for ${path.basename(destinationFolder)}`,
        );
      } else {
        RemoteClientLogger.logWarning(`cache item ${cacheArtifactName} doesn't exist ${destinationFolder}`);
        if (cacheSelection !== ``) {
          RemoteClientLogger.logWarning(
            `cache item ${cacheArtifactName}.tar${compressionSuffix} doesn't exist ${destinationFolder}`,
          );
          throw new Error(`Failed to get cache item, but cache hit was found: ${cacheSelection}`);
        }
      }
    } catch (error) {
      process.chdir(startPath);
      throw error;
    }
    process.chdir(startPath);
  }

  public static async handleCachePurging() {
    if (process.env.PURGE_REMOTE_BUILDER_CACHE !== undefined) {
      RemoteClientLogger.log(`purging ${CloudRunnerFolders.purgeRemoteCaching}`);
      fs.promises.rmdir(CloudRunnerFolders.cacheFolder, { recursive: true });
    }
  }
}
