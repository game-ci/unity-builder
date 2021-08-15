class Parameter {
  public name;
  public value;
}

class ImageEnvironmentFactory {
  public static getEnvVarString(parameters) {
    const environmentVariables = ImageEnvironmentFactory.getEnvironmentVariables(parameters);
    let string = '';
    for (const p of environmentVariables) {
      string += `--env ${p.name}="${p.value}" \
      `;
    }
    return string;
  }
  public static getEnvironmentVariables(parameters) {
    const {
      version,
      platform,
      projectPath,
      buildName,
      buildPath,
      buildFile,
      buildMethod,
      buildVersion,
      androidVersionCode,
      androidKeystoreName,
      androidKeystoreBase64,
      androidKeystorePass,
      androidKeyaliasName,
      androidKeyaliasPass,
      customParameters,
      sshAgent,
      chownFilesTo,
    } = parameters;

    const environmentVariables: Parameter[] = [
      { name: 'UNITY_LICENSE', value: process.env.UNITY_LICENSE },
      { name: 'UNITY_LICENSE_FILE', value: process.env.UNITY_LICENSE_FILE },
      { name: 'UNITY_EMAIL', value: process.env.UNITY_EMAIL },
      { name: 'UNITY_PASSWORD', value: process.env.UNITY_PASSWORD },
      { name: 'UNITY_SERIAL', value: process.env.UNITY_SERIAL },
      { name: 'UNITY_VERSION', value: version },
      { name: 'USYM_UPLOAD_AUTH_TOKEN', value: process.env.USYM_UPLOAD_AUTH_TOKEN },
      { name: 'PROJECT_PATH', value: projectPath },
      { name: 'BUILD_TARGET', value: platform },
      { name: 'BUILD_NAME', value: buildName },
      { name: 'BUILD_PATH', value: buildPath },
      { name: 'BUILD_FILE', value: buildFile },
      { name: 'BUILD_METHOD', value: buildMethod },
      { name: 'VERSION', value: buildVersion },
      { name: 'ANDROID_VERSION_CODE', value: androidVersionCode },
      { name: 'ANDROID_KEYSTORE_NAME', value: androidKeystoreName },
      { name: 'ANDROID_KEYSTORE_BASE64', value: androidKeystoreBase64 },
      { name: 'ANDROID_KEYSTORE_PASS', value: androidKeystorePass },
      { name: 'ANDROID_KEYALIAS_NAME', value: androidKeyaliasName },
      { name: 'ANDROID_KEYALIAS_PASS', value: androidKeyaliasPass },
      { name: 'CUSTOM_PARAMETERS', value: customParameters },
      { name: 'CHOWN_FILES_TO', value: chownFilesTo },
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
    if (sshAgent) environmentVariables.push({ name: 'SSH_AUTH_SOCK', value: '/ssh-agent' });
    return environmentVariables;
  }
}

export default ImageEnvironmentFactory;
