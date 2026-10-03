import { StringDecoder } from 'node:string_decoder';

// CLI releases such as v0.1.71 log version outputs through a mock
// @actions/core adapter instead of writing them to GITHUB_OUTPUT.
export function collectCliOutputs() {
  const outputs = new Map<string, string>();
  const decoder = new StringDecoder('utf8');
  let pending = '';

  function recordLine(line: string) {
    const match =
      /^\(mock\) Output "(buildVersion|androidVersionCode)" is set to "([^"\r\n]+)"\r?$/.exec(line);
    if (match) outputs.set(match[1], match[2]);
  }

  return {
    // Listen to bytes rather than @actions/exec's stdline callback, which
    // only splits on the host OS's EOL and can miss LF-only CLI output on
    // Windows. Retain only the unfinished line, not the whole Unity log.
    stdout(data: Buffer) {
      const lines = (pending + decoder.write(data)).split('\n');
      pending = lines.pop()!;
      for (const line of lines) recordLine(line);
    },
    finish() {
      recordLine(pending + decoder.end());
      return outputs;
    },
  };
}
