import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

export const argv = yargs(hideBin(process.argv))
  .option('endpoint', {
    type: 'string',
    description: 'Azure AI Project endpoint URL',
    demandOption: false
  })
  .option('deployment', {
    type: 'string',
    description: 'Model deployment name (default: gpt-4o)',
    demandOption: false
  })
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
  .option('repoCustomPromptFile', {
    type: 'string',
    description: 'Custom prompt file for the scanned repo',
    demandOption: false
  })
  .option('ignoreFiles', {
    type: 'string',
    description: 'Comma-separated list of glob patterns for files to ignore',
    demandOption: false
  })
  .epilogue('Note: If any required environment variables (AI_FOUNDRY_PROJECT_ENDPOINT, MODEL_DEPLOYMENT_NAME, BLOG_REPO_URL, BLOG_REPO_NAME) are missing from your .env file, you will be prompted to enter them interactively. The values will be used for the current session only.')
  .example('$0 --repoUrl=https://github.com/microsoft/mcp-for-beginners --repoName="MCP for Beginners"', 'Run with specific repository settings')
  .example('$0 --repoUrl=/path/to/local/repo --repoName="MCP for Beginners"', 'Run with local repository path')
  .example('$0 --endpoint=https://my-project.cognitiveservices.azure.com --deployment=gpt-4o', 'Run with Azure AI configuration')
  .example('$0', 'Run with interactive prompts for missing environment variables')
  .help()
  .argv;
