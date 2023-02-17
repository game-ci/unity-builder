import * as core from '@actions/core';
import * as semver from 'semver';

export default class AndroidVersioning {
  static determineVersionCode(version: string, inputVersionCode: string): string {
    if (inputVersionCode === '') {
      return AndroidVersioning.versionToVersionCode(version);
    }

    return inputVersionCode;
  }

  static versionToVersionCode(version: string): string {
    if (version === 'none') {
      core.info(`Versioning strategy is set to ${version}, so android version code should not be applied.`);

      return '0';
    }

    const parsedVersion = semver.parse(version);

    if (!parsedVersion) {
      core.warning(`Could not parse "${version}" to semver, defaulting android version code to 1`);

      return '1';
    }

    // The greatest value Google Plays allows is 2100000000.
    // Allow for 3 patch digits, 3 minor digits and 3 major digits.
    const versionCode = parsedVersion.major * 1000000 + parsedVersion.minor * 1000 + parsedVersion.patch;

    if (versionCode >= 2050000000) {
      throw new Error(
        `Generated versionCode ${versionCode} is dangerously close to the maximum allowed number 2100000000. Consider a different versioning scheme to be able to continue updating your application.`,
      );
    }
    core.info(`Using android versionCode ${versionCode}`);

    return versionCode.toString();
  }

  static determineSdkManagerParameters(targetSdkVersion: string) {
    const parsedVersion = Number.parseInt(targetSdkVersion.slice(-2), 10);

    return Number.isNaN(parsedVersion) ? '' : `platforms;android-${parsedVersion}`;
  }
}
