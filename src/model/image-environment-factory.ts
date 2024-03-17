import { DockerParameters, StringKeyValuePair } from './shared-types';

class ImageEnvironmentFactory {
  public static getEnvVarString(parameters: DockerParameters, additionalVariables: StringKeyValuePair[] = []) {
    const environmentVariables = ImageEnvironmentFactory.getEnvironmentVariables(parameters, additionalVariables);
    let string = '';
    for (const p of environmentVariables) {
      if (p.value === '' || p.value === undefined) {
        continue;
      }
      if (p.name !== 'ANDROID_KEYSTORE_BASE64' && p.value.toString().includes(`\n`)) {
        string += `--env ${p.name} `;
        process.env[p.name] = p.value.toString();
        continue;
      }

      string += `--env ${p.name}="${p.value}" `;
    }

    return string;
  }

  public static getEnvironmentVariables(parameters: DockerParameters, additionalVariables: StringKeyValuePair[] = []) {
    let environmentVariables: StringKeyValuePair[] = [
      { name: 'UNITY_EMAIL', value: process.env.UNITY_EMAIL },
      { name: 'UNITY_PASSWORD', value: process.env.UNITY_PASSWORD },
      { name: 'UNITY_SERIAL', value: parameters.unitySerial },
      {
        name: 'UNITY_LICENSING_SERVER',
        value: parameters.unityLicensingServer,
      },
      { name: 'SKIP_ACTIVATION', value: parameters.skipActivation },
      { name: 'UNITY_VERSION', value: parameters.editorVersion },
      {
        name: 'USYM_UPLOAD_AUTH_TOKEN',
        value: process.env.USYM_UPLOAD_AUTH_TOKEN,
      },
      { name: 'PROJECT_PATH', value: parameters.projectPath },
      { name: 'BUILD_TARGET', value: parameters.targetPlatform },
      { name: 'BUILD_NAME', value: parameters.buildName },
      { name: 'BUILD_PATH', value: parameters.buildPath },
      { name: 'BUILD_FILE', value: parameters.buildFile },
      { name: 'BUILD_METHOD', value: parameters.buildMethod },
      { name: 'MANUAL_EXIT', value: parameters.manualExit },
      { name: 'ENABLE_GPU', value: parameters.enableGpu },
      { name: 'VERSION', value: parameters.buildVersion },
      { name: 'ANDROID_VERSION_CODE', value: parameters.androidVersionCode },
      { name: 'ANDROID_KEYSTORE_NAME', value: parameters.androidKeystoreName },
      {
        name: 'ANDROID_KEYSTORE_BASE64',
        value: parameters.androidKeystoreBase64,
      },
      { name: 'ANDROID_KEYSTORE_PASS', value: parameters.androidKeystorePass },
      { name: 'ANDROID_KEYALIAS_NAME', value: parameters.androidKeyaliasName },
      { name: 'ANDROID_KEYALIAS_PASS', value: parameters.androidKeyaliasPass },
      {
        name: 'ANDROID_TARGET_SDK_VERSION',
        value: parameters.androidTargetSdkVersion,
      },
      {
        name: 'ANDROID_SDK_MANAGER_PARAMETERS',
        value: parameters.androidSdkManagerParameters,
      },
      { name: 'ANDROID_EXPORT_TYPE', value: parameters.androidExportType },
      { name: 'ANDROID_SYMBOL_TYPE', value: parameters.androidSymbolType },
      { name: 'CUSTOM_PARAMETERS', value: parameters.customParameters },
      { name: 'RUN_AS_HOST_USER', value: parameters.runAsHostUser },
      { name: 'CHOWN_FILES_TO', value: parameters.chownFilesTo },
      { name: 'GITHUB_REF', value: process.env.GITHUB_REF },
      { name: 'GITHUB_SHA', value: process.env.GITHUB_SHA },
      { name: 'GITHUB_REPOSITORY', value: process.env.GITHUB_REPOSITORY },
      { name: 'GITHUB_ACTOR', value: process.env.GITHUB_ACTOR },
      { name: 'GITHUB_WORKFLOW', value: process.env.GITHUB_WORKFLOW },
      { name: 'GITHUB_HEAD_REF', value: process.env.GITHUB_HEAD_REF },
      { name: 'GITHUB_BASE_REF', value: process.env.GITHUB_BASE_REF },
      { name: 'GITHUB_EVENT_NAME', value: process.env.GITHUB_EVENT_NAME },
      { name: 'GITHUB_ACTION', value: process.env.GITHUB_ACTION },
      { name: 'GITHUB_EVENT_PATH', value: process.env.GITHUB_EVENT_PATH },
      { name: 'RUNNER_OS', value: process.env.RUNNER_OS },
      { name: 'RUNNER_TOOL_CACHE', value: process.env.RUNNER_TOOL_CACHE },
      { name: 'RUNNER_TEMP', value: process.env.RUNNER_TEMP },
      { name: 'RUNNER_WORKSPACE', value: process.env.RUNNER_WORKSPACE },
    ];
    if (parameters.providerStrategy === 'local-docker') {
      for (const element of additionalVariables) {
        if (!environmentVariables.some((x) => element?.name === x?.name)) {
          environmentVariables.push(element);
        }
      }
      for (const variable of environmentVariables) {
        if (!environmentVariables.some((x) => variable?.name === x?.name)) {
          environmentVariables = environmentVariables.filter((x) => x !== variable);
        }
      }
    }
    if (parameters.sshAgent) {
      environmentVariables.push({ name: 'SSH_AUTH_SOCK', value: '/ssh-agent' });
    }

    return environmentVariables;
  }
}

export default ImageEnvironmentFactory;
