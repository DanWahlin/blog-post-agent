import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

export const argv = yargs(hideBin(process.argv))
  .option('repoUrl', {
    type: 'string',
    description: 'GitHub repo URL',
    demandOption: false
  })
  .option('repoName', {
    type: 'string',
    description: 'Repo display name',
    demandOption: false
  })
  .option('ignoreFiles', {
    type: 'string',
    description: 'Comma-separated list of glob patterns for files to ignore',
    demandOption: false
  })
  .help()
  .argv;
