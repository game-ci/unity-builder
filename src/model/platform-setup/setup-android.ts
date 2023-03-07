import fs from 'node:fs';
import path from 'node:path';
import { BuildParameters } from '..';

class SetupAndroid {
  public static async setup(buildParameters: BuildParameters) {
    const { targetPlatform, androidKeystoreBase64, androidKeystoreName, projectPath } = buildParameters;

    if (targetPlatform === 'Android' && androidKeystoreBase64 !== '' && androidKeystoreName !== '') {
      SetupAndroid.setupAndroidRun(androidKeystoreBase64, androidKeystoreName, projectPath);
    }
  }

  private static setupAndroidRun(androidKeystoreBase64: string, androidKeystoreName: string, projectPath: string) {
    const decodedKeystore = Buffer.from(androidKeystoreBase64, 'base64').toString('binary');
    const githubWorkspace = process.env.GITHUB_WORKSPACE || '';
    fs.writeFileSync(path.join(githubWorkspace, projectPath, androidKeystoreName), decodedKeystore, 'binary');
  }
}

export default SetupAndroid;
