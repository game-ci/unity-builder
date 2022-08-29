import BuildVersionGenerator from './build-version-generator.ts';
import AndroidBuildVersionGenerator from './android-build-version-generator.ts';

export const buildVersioning = async (argv) => {
  const { projectPath, versioningStrategy, version, allowDirtyBuild, androidVersionCode, buildVersion } = argv;

  const buildVersionGenerator = new BuildVersionGenerator(projectPath);

  argv.buildVersion = await buildVersionGenerator.determineBuildVersion(versioningStrategy, version, allowDirtyBuild);

  if (!androidVersionCode) {
    argv.androidVersionCode = AndroidBuildVersionGenerator.determineVersionCode(buildVersion);
  }
};
