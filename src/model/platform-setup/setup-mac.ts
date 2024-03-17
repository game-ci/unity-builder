import { BuildParameters } from '..';
import { getUnityChangeset } from 'unity-changeset';
import { exec, getExecOutput } from '@actions/exec';
import { restoreCache, saveCache } from '@actions/cache';

import fs from 'node:fs';

class SetupMac {
  static unityHubBasePath = `/Applications/"Unity Hub.app"`;
  static unityHubExecPath = `${SetupMac.unityHubBasePath}/Contents/MacOS/"Unity Hub"`;

  public static async setup(buildParameters: BuildParameters, actionFolder: string) {
    const unityEditorPath = `/Applications/Unity/Hub/Editor/${buildParameters.editorVersion}/Unity.app/Contents/MacOS/Unity`;

    if (!fs.existsSync(this.unityHubExecPath.replace(/"/g, ''))) {
      await SetupMac.installUnityHub(buildParameters);
    }

    if (!fs.existsSync(unityEditorPath.replace(/"/g, ''))) {
      await SetupMac.installUnity(buildParameters);
    }

    await SetupMac.setEnvironmentVariables(buildParameters, actionFolder);
  }

  private static async installUnityHub(buildParameters: BuildParameters, silent = false) {
    // Can't use quotes in the cache package so we need a different path
    const unityHubCachePath = `/Applications/Unity\\ Hub.app`;

    const targetHubVersion =
      buildParameters.unityHubVersionOnMac !== ''
        ? buildParameters.unityHubVersionOnMac
        : await SetupMac.getLatestUnityHubVersion();

    const restoreKey = `Cache-MacOS-UnityHub@${targetHubVersion}`;

    if (buildParameters.cacheUnityInstallationOnMac) {
      const cacheId = await restoreCache([unityHubCachePath], restoreKey);
      if (cacheId) {
        // Cache restored successfully, unity hub is installed now
        return;
      }
    }

    const commandSuffix = buildParameters.unityHubVersionOnMac !== '' ? `@${buildParameters.unityHubVersionOnMac}` : '';
    const command = `brew install unity-hub${commandSuffix}`;

    // Ignoring return code because the log seems to overflow the internal buffer which triggers
    // a false error
    const errorCode = await exec(command, undefined, {
      silent,
      ignoreReturnCode: true,
    });
    if (errorCode) {
      throw new Error(`There was an error installing the Unity Editor. See logs above for details.`);
    }

    if (buildParameters.cacheUnityInstallationOnMac) {
      await saveCache([unityHubCachePath], restoreKey);
    }
  }

  /**
   * Gets the latest version of Unity Hub available on brew
   * @returns The latest version of Unity Hub available on brew
   */
  private static async getLatestUnityHubVersion(): Promise<string> {
    // Need to check if the latest version available is the same as the one we have cached
    const hubVersionCommand = `/bin/bash -c "brew info unity-hub | grep -o '[0-9]\\+\\.[0-9]\\+\\.[0-9]\\+'"`;
    const result = await getExecOutput(hubVersionCommand, undefined, {
      silent: true,
    });
    if (result.exitCode === 0 && result.stdout !== '') {
      return result.stdout;
    }

    return '';
  }

  private static getArchitectureParameters(): string[] {
    const architectureArgument = [];

    switch (process.arch) {
      case 'x64':
        architectureArgument.push('--architecture', 'x86_64');
        break;
      case 'arm64':
        architectureArgument.push('--architecture', 'arm64');
        break;
      default:
        throw new Error(`Unsupported architecture: ${process.arch}.`);
    }

    return architectureArgument;
  }

  private static getModuleParametersForTargetPlatform(targetPlatform: string): string[] {
    const moduleArgument = [];
    switch (targetPlatform) {
      case 'iOS':
        moduleArgument.push('--module', 'ios');
        break;
      case 'tvOS':
        moduleArgument.push('--module', 'tvos');
        break;
      case 'StandaloneOSX':
        moduleArgument.push('--module', 'mac-il2cpp');
        break;
      case 'Android':
        moduleArgument.push('--module', 'android');
        break;
      case 'WebGL':
        moduleArgument.push('--module', 'webgl');
        break;
      default:
        throw new Error(`Unsupported module for target platform: ${targetPlatform}.`);
    }

    return moduleArgument;
  }

  private static async installUnity(buildParameters: BuildParameters, silent = false) {
    const unityEditorPath = `/Applications/Unity/Hub/Editor/${buildParameters.editorVersion}`;
    const key = `Cache-MacOS-UnityEditor-With-Module-${buildParameters.targetPlatform}@${buildParameters.editorVersion}`;

    if (buildParameters.cacheUnityInstallationOnMac) {
      const cacheId = await restoreCache([unityEditorPath], key);
      if (cacheId) {
        // Cache restored successfully, unity editor is installed now
        return;
      }
    }

    const unityChangeset = await getUnityChangeset(buildParameters.editorVersion);
    const moduleArguments = SetupMac.getModuleParametersForTargetPlatform(buildParameters.targetPlatform);
    const architectureArguments = SetupMac.getArchitectureParameters();

    const execArguments: string[] = [
      '--',
      '--headless',
      'install',
      ...['--version', buildParameters.editorVersion],
      ...['--changeset', unityChangeset.changeset],
      ...moduleArguments,
      ...architectureArguments,
      '--childModules',
    ];

    // Ignoring return code because the log seems to overflow the internal buffer which triggers
    // a false error
    const errorCode = await exec(this.unityHubExecPath, execArguments, {
      silent,
      ignoreReturnCode: true,
    });
    if (errorCode) {
      throw new Error(`There was an error installing the Unity Editor. See logs above for details.`);
    }

    if (buildParameters.cacheUnityInstallationOnMac) {
      await saveCache([unityEditorPath], key);
    }
  }

  private static async setEnvironmentVariables(buildParameters: BuildParameters, actionFolder: string) {
    // Need to set environment variables from here because we execute
    // the scripts on the host for mac
    process.env.ACTION_FOLDER = actionFolder;
    process.env.UNITY_VERSION = buildParameters.editorVersion;
    process.env.UNITY_SERIAL = buildParameters.unitySerial;
    process.env.UNITY_LICENSING_SERVER = buildParameters.unityLicensingServer;
    process.env.SKIP_ACTIVATION = buildParameters.skipActivation;
    process.env.PROJECT_PATH = buildParameters.projectPath;
    process.env.BUILD_TARGET = buildParameters.targetPlatform;
    process.env.BUILD_NAME = buildParameters.buildName;
    process.env.BUILD_PATH = buildParameters.buildPath;
    process.env.BUILD_FILE = buildParameters.buildFile;
    process.env.BUILD_METHOD = buildParameters.buildMethod;
    process.env.VERSION = buildParameters.buildVersion;
    process.env.ANDROID_VERSION_CODE = buildParameters.androidVersionCode;
    process.env.ANDROID_KEYSTORE_NAME = buildParameters.androidKeystoreName;
    process.env.ANDROID_KEYSTORE_BASE64 = buildParameters.androidKeystoreBase64;
    process.env.ANDROID_KEYSTORE_PASS = buildParameters.androidKeystorePass;
    process.env.ANDROID_KEYALIAS_NAME = buildParameters.androidKeyaliasName;
    process.env.ANDROID_KEYALIAS_PASS = buildParameters.androidKeyaliasPass;
    process.env.ANDROID_TARGET_SDK_VERSION = buildParameters.androidTargetSdkVersion;
    process.env.ANDROID_SDK_MANAGER_PARAMETERS = buildParameters.androidSdkManagerParameters;
    process.env.ANDROID_EXPORT_TYPE = buildParameters.androidExportType;
    process.env.ANDROID_SYMBOL_TYPE = buildParameters.androidSymbolType;
    process.env.CUSTOM_PARAMETERS = buildParameters.customParameters;
    process.env.CHOWN_FILES_TO = buildParameters.chownFilesTo;
    process.env.MANUAL_EXIT = buildParameters.manualExit.toString();
    process.env.ENABLE_GPU = buildParameters.enableGpu.toString();
  }
}

export default SetupMac;
