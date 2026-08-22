// Thin wrapper: this action installs and shells out to the game-ci CLI
// (game-ci/cli's `build` command) as a subprocess, so the exact same code
// path this runs in CI also runs when a developer invokes the CLI directly
// on their own machine. See game-ci/roadmap#11 (workstream 2), and the
// matching rewrite already shipped for game-ci/unity-activate.
//
// Unity credentials (UNITY_EMAIL, UNITY_PASSWORD, UNITY_SERIAL,
// UNITY_LICENSE, UNITY_LICENSING_SERVER) are read by the CLI itself from
// its own process environment - never passed as CLI arguments, since argv
// can leak through process listings and command-logging.
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { buildCliArgs } from './build-args';
import { downloadCli } from './download-cli';
import { resolveProjectPath } from './resolve-project-path';

export async function run() {
  try {
    const unityVersion = core.getInput('unityVersion') || 'auto';
    if (unityVersion !== 'auto') {
      core.warning(
        `unityVersion="${unityVersion}" is ignored: the underlying game-ci CLI always detects the Unity ` +
          "version from the checked-out project's ProjectSettings/ProjectVersion.txt and has no flag to " +
          'override it yet.',
      );
    }

    const cliVersion = core.getInput('cliVersion') || 'latest';
    const cliPath = await downloadCli(cliVersion);

    const projectPath = resolveProjectPath({
      input: core.getInput('projectPath'),
      existsSync: fs.existsSync,
      joinPath: path.join,
    });

    const args = buildCliArgs({
      getInput: (name) => (name === 'projectPath' ? projectPath : core.getInput(name)),
    });

    const exitCode = await exec.exec(cliPath, args, { ignoreReturnCode: true });

    // Matches the original action's engineExitCode output: 0 on success,
    // otherwise the exit code of whichever step (activation or build) - or,
    // for providerStrategy=local-system, whichever stage of the
    // orchestrator's setup/build/cleanup workflow - failed. Either way it's
    // exactly what the CLI subprocess itself exits with, so no special
    // handling is needed here for the orchestrate path.
    core.setOutput('engineExitCode', exitCode);

    if (exitCode !== 0) {
      core.setFailed(`Build failed with exit code ${exitCode}`);
    }

    // buildVersion/androidVersionCode are set by the CLI subprocess itself
    // via @actions/core, which writes directly to the file at
    // $GITHUB_OUTPUT - inherited by the child process, so no extra
    // plumbing is needed here to forward them.
  } catch (error: any) {
    core.setFailed(error.message);
  }
}

if (process.env.NODE_ENV !== 'test') {
  run();
}
