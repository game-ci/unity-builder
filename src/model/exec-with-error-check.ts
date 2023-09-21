import { getExecOutput, ExecOptions } from '@actions/exec';
import { summary } from '@actions/core';

export async function execWithErrorCheck(
  commandLine: string,
  arguments_?: string[],
  options?: ExecOptions,
  errorWhenMissingUnityBuildResults: boolean = true,
): Promise<number> {
  const result = await getExecOutput(commandLine, arguments_, options);

  if (!errorWhenMissingUnityBuildResults) {
    return result.exitCode;
  }

  // Check for errors in the Unity Build Results section
  const unityMatch = result.stdout.match(/^#\s*Build results\s*#(.*)^Size:/ms);

  if (unityMatch) {
    const buildResults = unityMatch[1];
    const errorMatch = buildResults.match(/^Errors:\s*(\d+)$/m);
    if (errorMatch && Number.parseInt(errorMatch[1], 10) !== 0) {
      throw new Error(`There was an error building the project. Please read the logs for details.`);
    }
    await summary.addHeading('Build Results').addQuote(unityMatch[0]).write();

    return result.exitCode;
  }

  // Check for presence of game-ci message(s)
  const gameciMatch = result.stdout.match(/^GAME_CI_BUILD_SUCCESS$/ms);

  if (gameciMatch) {
    const quote =
      result.stdout
        .match(/^GAME_CI_STEP_SUMMARY.*$/gm)
        ?.map((x) => x.replace('GAME_CI_STEP_SUMMARY', ''))
        .join('\n\n') ?? '<No GAME_CI_STEP_SUMMARY messages found>';
    await summary.addHeading('Build Results').addQuote(quote).write();

    return result.exitCode;
  }

  throw new Error(
    `There was an error building the project. Did not find success messages in logs (either Unity's build results or GAME_CI_BUILD_SUCCESS).`,
  );
}
