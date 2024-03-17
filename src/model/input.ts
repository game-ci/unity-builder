import fs from 'node:fs';
import path from 'node:path';
import { Cli } from './cli/cli';
import CloudRunnerQueryOverride from './cloud-runner/options/cloud-runner-query-override';
import Platform from './platform';
import GitHub from './github';
import os from 'node:os';

import * as core from '@actions/core';

export type InputKey = keyof typeof Input;

/**
 * Input variables specified in workflows using "with" prop.
 *
 * Note that input is always passed as a string, even booleans.
 *
 * Todo: rename to UserInput and remove anything that is not direct input from the user / ci workflow
 */
class Input {
  public static getInput(query: string): string | undefined {
    if (GitHub.githubInputEnabled) {
      const coreInput = core.getInput(query);
      if (coreInput && coreInput !== '') {
        return coreInput;
      }
    }
    const alternativeQuery = Input.ToEnvVarFormat(query);

    // Query input sources
    if (Cli.query(query, alternativeQuery)) {
      return Cli.query(query, alternativeQuery);
    }

    if (CloudRunnerQueryOverride.query(query, alternativeQuery)) {
      return CloudRunnerQueryOverride.query(query, alternativeQuery);
    }

    if (process.env[query] !== undefined) {
      return process.env[query]!;
    }

    if (alternativeQuery !== query && process.env[alternativeQuery] !== undefined) {
      return process.env[alternativeQuery]!;
    }
  }

  static get region(): string {
    return Input.getInput('region') ?? 'eu-west-2';
  }

  static get githubRepo(): string | undefined {
    return Input.getInput('GITHUB_REPOSITORY') ?? Input.getInput('GITHUB_REPO') ?? undefined;
  }

  static get branch(): string {
    if (Input.getInput(`GITHUB_REF`)) {
      return Input.getInput(`GITHUB_REF`)!.replace('refs/', '').replace(`head/`, '').replace(`heads/`, '');
    } else if (Input.getInput('branch')) {
      return Input.getInput('branch')!;
    } else {
      return '';
    }
  }

  static get gitSha(): string {
    if (Input.getInput(`GITHUB_SHA`)) {
      return Input.getInput(`GITHUB_SHA`)!;
    } else if (Input.getInput(`GitSHA`)) {
      return Input.getInput(`GitSHA`)!;
    }

    return '';
  }

  static get runNumber(): string {
    return Input.getInput('GITHUB_RUN_NUMBER') ?? '0';
  }

  static get targetPlatform(): string {
    return Input.getInput('targetPlatform') ?? Platform.default;
  }

  static get unityVersion(): string {
    return Input.getInput('unityVersion') ?? 'auto';
  }

  static get customImage(): string {
    return Input.getInput('customImage') ?? '';
  }

  static get projectPath(): string {
    const input = Input.getInput('projectPath');
    let rawProjectPath;

    if (input) {
      rawProjectPath = input;
    } else if (
      fs.existsSync(path.join('test-project', 'ProjectSettings', 'ProjectVersion.txt')) &&
      !fs.existsSync(path.join('ProjectSettings', 'ProjectVersion.txt'))
    ) {
      rawProjectPath = 'test-project';
    } else {
      rawProjectPath = '.';
    }

    return rawProjectPath.replace(/\/$/, '');
  }

  static get runnerTempPath(): string {
    return Input.getInput('RUNNER_TEMP') ?? '';
  }

  static get buildName(): string {
    return Input.getInput('buildName') ?? Input.targetPlatform;
  }

  static get buildsPath(): string {
    return Input.getInput('buildsPath') ?? 'build';
  }

  static get unityLicensingServer(): string {
    return Input.getInput('unityLicensingServer') ?? '';
  }

  static get buildMethod(): string {
    return Input.getInput('buildMethod') ?? ''; // Processed in docker file
  }

  static get manualExit(): boolean {
    const input = Input.getInput('manualExit') ?? false;

    return input === 'true';
  }

  static get enableGpu(): boolean {
    const input = Input.getInput('enableGpu') ?? false;

    return input === 'true';
  }

  static get customParameters(): string {
    return Input.getInput('customParameters') ?? '';
  }

  static get versioningStrategy(): string {
    return Input.getInput('versioning') ?? 'Semantic';
  }

  static get specifiedVersion(): string {
    return Input.getInput('version') ?? '';
  }

  static get androidVersionCode(): string {
    return Input.getInput('androidVersionCode') ?? '';
  }

  static get androidExportType(): string {
    return Input.getInput('androidExportType') ?? 'androidPackage';
  }

  static get androidKeystoreName(): string {
    return Input.getInput('androidKeystoreName') ?? '';
  }

  static get androidKeystoreBase64(): string {
    return Input.getInput('androidKeystoreBase64') ?? '';
  }

  static get androidKeystorePass(): string {
    return Input.getInput('androidKeystorePass') ?? '';
  }

  static get androidKeyaliasName(): string {
    return Input.getInput('androidKeyaliasName') ?? '';
  }

  static get androidKeyaliasPass(): string {
    return Input.getInput('androidKeyaliasPass') ?? '';
  }

  static get androidTargetSdkVersion(): string {
    return Input.getInput('androidTargetSdkVersion') ?? '';
  }

  static get androidSymbolType(): string {
    return Input.getInput('androidSymbolType') ?? 'none';
  }

  static get sshAgent(): string {
    return Input.getInput('sshAgent') ?? '';
  }

  static get sshPublicKeysDirectoryPath(): string {
    return Input.getInput('sshPublicKeysDirectoryPath') ?? '';
  }

  static get gitPrivateToken(): string | undefined {
    return Input.getInput('gitPrivateToken');
  }

  static get runAsHostUser(): string {
    return Input.getInput('runAsHostUser')?.toLowerCase() ?? 'false';
  }

  static get chownFilesTo() {
    return Input.getInput('chownFilesTo') ?? '';
  }

  static get allowDirtyBuild(): boolean {
    const input = Input.getInput('allowDirtyBuild') ?? false;

    return input === 'true';
  }

  static get cacheUnityInstallationOnMac(): boolean {
    const input = Input.getInput('cacheUnityInstallationOnMac') ?? false;

    return input === 'true';
  }

  static get unityHubVersionOnMac(): string {
    const input = Input.getInput('unityHubVersionOnMac') ?? '';

    return input !== '' ? input : '';
  }

  static get unitySerial(): string | undefined {
    return Input.getInput('UNITY_SERIAL');
  }

  static get unityLicense(): string | undefined {
    return Input.getInput('UNITY_LICENSE');
  }

  static get dockerWorkspacePath(): string {
    return Input.getInput('dockerWorkspacePath') ?? '/github/workspace';
  }

  static get dockerCpuLimit(): string {
    return Input.getInput('dockerCpuLimit') ?? os.cpus().length.toString();
  }

  static get dockerMemoryLimit(): string {
    const bytesInMegabyte = 1024 * 1024;

    let memoryMultiplier;
    switch (os.platform()) {
      case 'linux':
        memoryMultiplier = 0.95;
        break;
      case 'win32':
        memoryMultiplier = 0.8;
        break;
      default:
        memoryMultiplier = 0.75;
        break;
    }

    return (
      Input.getInput('dockerMemoryLimit') ?? `${Math.floor((os.totalmem() / bytesInMegabyte) * memoryMultiplier)}m`
    );
  }

  static get dockerIsolationMode(): string {
    return Input.getInput('dockerIsolationMode') ?? 'default';
  }

  static get containerRegistryRepository(): string {
    return Input.getInput('containerRegistryRepository') ?? 'unityci/editor';
  }

  static get containerRegistryImageVersion(): string {
    return Input.getInput('containerRegistryImageVersion') ?? '3';
  }

  static get skipActivation(): string {
    return Input.getInput('skipActivation')?.toLowerCase() ?? 'false';
  }

  public static ToEnvVarFormat(input: string) {
    if (input.toUpperCase() === input) {
      return input;
    }

    return input
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .toUpperCase()
      .replace(/ /g, '_');
  }
}

export default Input;
