import BuildParameters from './build-parameters';
import { ReadLicense } from './input-readers/test-license-reader';

class Parameter {
  public name;
  public value;
}

class ImageEnvironmentFactory {
  public static getEnvVarString(parameters) {
    const environmentVariables = ImageEnvironmentFactory.getEnvironmentVariables(parameters);
    let string = '';
    for (const p of environmentVariables) {
      if (p.value === '' || p.value === undefined) {
        continue;
      }
      if (p.name !== 'ANDROID_KEYSTORE_BASE64' && p.value.toString().includes(`\n`)) {
        string += `--env ${p.name} `;
        continue;
      }

      string += `--env ${p.name}="${p.value}" `;
    }

    return string;
  }
  public static getEnvironmentVariables(parameters: BuildParameters) {
    const environmentVariables: Parameter[] = [
      { name: 'UNITY_LICENSE', value: process.env.UNITY_LICENSE || ReadLicense() },
      { name: 'UNITY_LICENSE_FILE', value: process.env.UNITY_LICENSE_FILE },
      { name: 'UNITY_EMAIL', value: process.env.UNITY_EMAIL },
      { name: 'UNITY_PASSWORD', value: process.env.UNITY_PASSWORD },
      { name: 'UNITY_SERIAL', value: parameters.unitySerial },
      { name: 'UNITY_VERSION', value: parameters.editorVersion },
      { name: 'USYM_UPLOAD_AUTH_TOKEN', value: process.env.USYM_UPLOAD_AUTH_TOKEN },
      { name: 'PROJECT_PATH', value: parameters.projectPath },
      { name: 'BUILD_TARGET', value: parameters.targetPlatform },
      { name: 'BUILD_NAME', value: parameters.buildName },
      { name: 'BUILD_PATH', value: parameters.buildPath },
      { name: 'BUILD_FILE', value: parameters.buildFile },
      { name: 'BUILD_METHOD', value: parameters.buildMethod },
      { name: 'VERSION', value: parameters.buildVersion },
      { name: 'ANDROID_VERSION_CODE', value: parameters.androidVersionCode },
      { name: 'ANDROID_KEYSTORE_NAME', value: parameters.androidKeystoreName },
      { name: 'ANDROID_KEYSTORE_BASE64', value: parameters.androidKeystoreBase64 },
      { name: 'ANDROID_KEYSTORE_PASS', value: parameters.androidKeystorePass },
      { name: 'ANDROID_KEYALIAS_NAME', value: parameters.androidKeyaliasName },
      { name: 'ANDROID_KEYALIAS_PASS', value: parameters.androidKeyaliasPass },
      { name: 'ANDROID_TARGET_SDK_VERSION', value: parameters.androidTargetSdkVersion },
      { name: 'ANDROID_SDK_MANAGER_PARAMETERS', value: parameters.androidSdkManagerParameters },
      { name: 'CUSTOM_PARAMETERS', value: parameters.customParameters },
      { name: 'CHOWN_FILES_TO', value: parameters.chownFilesTo },
      { name: 'GITHUB_REF', value: process.env.GITHUB_REF },
      { name: 'GITHUB_SHA', value: process.env.GITHUB_SHA },
      { name: 'GITHUB_REPOSITORY', value: process.env.GITHUB_REPOSITORY },
      { name: 'GITHUB_ACTOR', value: process.env.GITHUB_ACTOR },
      { name: 'GITHUB_WORKFLOW', value: process.env.GITHUB_WORKFLOW },
      { name: 'GITHUB_HEAD_REF', value: process.env.GITHUB_HEAD_REF },
      { name: 'GITHUB_BASE_REF', value: process.env.GITHUB_BASE_REF },
      { name: 'GITHUB_EVENT_NAME', value: process.env.GITHUB_EVENT_NAME },
      { name: 'GITHUB_WORKSPACE', value: '/github/workspace' },
      { name: 'GITHUB_ACTION', value: process.env.GITHUB_ACTION },
      { name: 'GITHUB_EVENT_PATH', value: process.env.GITHUB_EVENT_PATH },
      { name: 'RUNNER_OS', value: process.env.RUNNER_OS },
      { name: 'RUNNER_TOOL_CACHE', value: process.env.RUNNER_TOOL_CACHE },
      { name: 'RUNNER_TEMP', value: process.env.RUNNER_TEMP },
      { name: 'RUNNER_WORKSPACE', value: process.env.RUNNER_WORKSPACE },
    ];
    if (parameters.sshAgent) environmentVariables.push({ name: 'SSH_AUTH_SOCK', value: '/ssh-agent' });

    return environmentVariables;
  }
}

export default ImageEnvironmentFactory;
