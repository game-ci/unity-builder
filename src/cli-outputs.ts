import { StringDecoder } from 'node:string_decoder';

/**
 * Collect version records printed by legacy CLIs such as v0.1.71, whose
 * mock @actions/core adapter does not write to GITHUB_OUTPUT.
 */
export function collectCliOutputs() {
  const outputs = new Map<string, string>();
  const decoder = new StringDecoder('utf8');
  let pending = '';

  /** Save only complete legacy records for the two supported version outputs. */
  function recordLine(line: string) {
    const match =
      /^\(mock\) Output "(buildVersion|androidVersionCode)" is set to "([^"\r\n]+)"\r?$/.exec(line);
    if (match) outputs.set(match[1], match[2]);
  }

  return {
    /**
     * Decode stdout incrementally, retaining only the unfinished line.
     * Unlike @actions/exec's stdline callback, accept LF on Windows too.
     */
    stdout(data: Buffer) {
      const lines = (pending + decoder.write(data)).split('\n');
      pending = lines.pop()!;
      for (const line of lines) recordLine(line);
    },
    /** Flush an unterminated final record and return the collected output values. */
    finish() {
      recordLine(pending + decoder.end());
      return outputs;
    },
  };
}
