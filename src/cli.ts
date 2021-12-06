import { BuildParameters, CloudRunner, Input } from './model';
import { Command } from 'commander-ts';

// eslint-disable-next-line no-console
console.log(`Created base image`);
const program = new Command();
program.version('0.0.1');
program.parse();
// eslint-disable-next-line no-console
console.log(`Created base image`);

const options = program.opts();

Input.githubEnabled = false;
// eslint-disable-next-line no-console
console.log(`Created base image`);

async function run() {
  // eslint-disable-next-line no-console
  console.log(`Created base image`);
  options.projectPath = './test-project';
  options.versioning = 'None';
  Input.cliOptions = options;
  const buildParameter = await BuildParameters.create();
  await CloudRunner.run(buildParameter, ' ');
}
run();
