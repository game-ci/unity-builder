import CloudRunnerSecret from '../options/cloud-runner-secret';
import CloudRunnerEnvironmentVariable from '../options/cloud-runner-environment-variable';
import CloudRunnerLogger from '../services/core/cloud-runner-logger';
import { CloudRunnerFolders } from '../options/cloud-runner-folders';
import CloudRunner from '../cloud-runner';

export class AsyncWorkflow {
  public static async runAsyncWorkflow(
    environmentVariables: CloudRunnerEnvironmentVariable[],
    secrets: CloudRunnerSecret[],
  ): Promise<string> {
    try {
      CloudRunnerLogger.log(`Cloud Runner is running async mode`);
      const asyncEnvironmentVariable = new CloudRunnerEnvironmentVariable();
      asyncEnvironmentVariable.name = `ASYNC_WORKFLOW`;
      asyncEnvironmentVariable.value = `true`;

      let output = '';

      output += await CloudRunner.Provider.runTaskInWorkflow(
        CloudRunner.buildParameters.buildGuid,
        `ubuntu`,
        `apt-get update > /dev/null
apt-get install -y curl tar tree npm git git-lfs jq git > /dev/null
mkdir /builder
printenv
git config --global advice.detachedHead false
git config --global filter.lfs.smudge "git-lfs smudge --skip -- %f"
git config --global filter.lfs.process "git-lfs filter-process --skip"
BRANCH="${CloudRunner.buildParameters.cloudRunnerBranch}"
REPO="${CloudRunnerFolders.unityBuilderRepoUrl}"
if [ -n "$(git ls-remote --heads \"$REPO\" \"$BRANCH\" 2>/dev/null)" ]; then
  git clone -q -b "$BRANCH" "$REPO" /builder
else
  echo "Remote branch $BRANCH not found in $REPO; falling back to a known branch"
  git clone -q -b cloud-runner-develop "$REPO" /builder \
    || git clone -q -b main "$REPO" /builder \
    || git clone -q "$REPO" /builder
fi
git clone -q -b ${CloudRunner.buildParameters.branch} ${CloudRunnerFolders.targetBuildRepoUrl} /repo
cd /repo
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install
aws --version
node /builder/dist/index.js -m async-workflow`,
        `/${CloudRunnerFolders.buildVolumeFolder}`,
        `/${CloudRunnerFolders.buildVolumeFolder}/`,
        [...environmentVariables, asyncEnvironmentVariable],
        [
          ...secrets,
          ...[
            {
              ParameterKey: `GITHUB_TOKEN`,
              EnvironmentVariable: `GITHUB_TOKEN`,
              ParameterValue: process.env.GITHUB_TOKEN || ``,
            },
            {
              ParameterKey: `AWS_ACCESS_KEY_ID`,
              EnvironmentVariable: `AWS_ACCESS_KEY_ID`,
              ParameterValue: process.env.AWS_ACCESS_KEY_ID || ``,
            },
            {
              ParameterKey: `AWS_SECRET_ACCESS_KEY`,
              EnvironmentVariable: `AWS_SECRET_ACCESS_KEY`,
              ParameterValue: process.env.AWS_SECRET_ACCESS_KEY || ``,
            },
          ],
        ],
      );

      return output;
    } catch (error) {
      throw error;
    }
  }
}
