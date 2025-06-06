import inquirer from 'inquirer';

interface EnvironmentConfig {
    AI_FOUNDRY_PROJECT_ENDPOINT: string;
    MODEL_DEPLOYMENT_NAME: string;
    BLOG_REPO_URL: string;
    BLOG_REPO_NAME: string;
    BLOG_REPO_IGNORE_FILES: string;
    BLOG_CUSTOM_PROMPT_FILE?: string;
}

/**
 * Prompts the user for missing environment variables
 */
export async function promptForMissingEnvVars(
    currentValues: Partial<EnvironmentConfig>
): Promise<EnvironmentConfig> {
    let answers: any = {};

    if (!currentValues.AI_FOUNDRY_PROJECT_ENDPOINT) {
        const endpointAnswer = await inquirer.prompt({
            type: 'input',
            name: 'AI_FOUNDRY_PROJECT_ENDPOINT',
            message: 'Enter your Azure AI Project endpoint URL:',
            validate: (input: string) => {
                if (!input.trim()) {
                    return 'Project endpoint is required';
                }
                if (!input.includes('https://')) {
                    return 'Please enter a valid HTTPS URL';
                }
                return true;
            }
        });
        answers.AI_FOUNDRY_PROJECT_ENDPOINT = endpointAnswer.AI_FOUNDRY_PROJECT_ENDPOINT;
    }

    if (!currentValues.MODEL_DEPLOYMENT_NAME) {
        const deploymentAnswer = await inquirer.prompt({
            type: 'input',
            name: 'MODEL_DEPLOYMENT_NAME',
            message: 'Enter your model deployment name:',
            default: 'gpt-4o',
            validate: (input: string) => {
                if (!input.trim()) {
                    return 'Model deployment name is required';
                }
                return true;
            }
        });
        answers.MODEL_DEPLOYMENT_NAME = deploymentAnswer.MODEL_DEPLOYMENT_NAME;
    }

    if (!currentValues.BLOG_REPO_URL) {
        const repoUrlAnswer = await inquirer.prompt({
            type: 'input',
            name: 'BLOG_REPO_URL',
            message: 'Enter the GitHub repository URL (or path to local repo):',
            validate: (input: string) => {
                if (!input.trim()) {
                    return 'Repository URL is required';
                }
                if (!input.includes('github.com') && !input.startsWith('/')) {
                    return 'Please enter a valid GitHub URL or a local path';
                }
                return true;
            }
        });
        answers.BLOG_REPO_URL = repoUrlAnswer.BLOG_REPO_URL;
    }

    if (!currentValues.BLOG_REPO_NAME) {
        const repoNameAnswer = await inquirer.prompt({
            type: 'input',
            name: 'BLOG_REPO_NAME',
            message: 'Enter a display name for the repository:',
            validate: (input: string) => {
                if (!input.trim()) {
                    return 'Repository name is required';
                }
                return true;
            }
        });
        answers.BLOG_REPO_NAME = repoNameAnswer.BLOG_REPO_NAME;
    }

    if (!currentValues.BLOG_REPO_IGNORE_FILES) {
        const ignoreFilesAnswer = await inquirer.prompt({
            type: 'input',
            name: 'BLOG_REPO_IGNORE_FILES',
            message: 'Enter glob patterns for files to ignore (optional):',
            default: '**/translations/*, **/translated_images/*'
        });
        answers.BLOG_REPO_IGNORE_FILES = ignoreFilesAnswer.BLOG_REPO_IGNORE_FILES;
    }

    // if (Object.keys(answers).length > 0) {
    //     console.log('\n🔧 Some environment variables are missing. Please provide the following information:');
    // }

    const finalConfig: EnvironmentConfig = {
        AI_FOUNDRY_PROJECT_ENDPOINT: currentValues.AI_FOUNDRY_PROJECT_ENDPOINT || answers.AI_FOUNDRY_PROJECT_ENDPOINT || '',
        MODEL_DEPLOYMENT_NAME: currentValues.MODEL_DEPLOYMENT_NAME || answers.MODEL_DEPLOYMENT_NAME || 'gpt-4o',
        BLOG_REPO_URL: currentValues.BLOG_REPO_URL || answers.BLOG_REPO_URL || '',
        BLOG_REPO_NAME: currentValues.BLOG_REPO_NAME || answers.BLOG_REPO_NAME || '',
        BLOG_REPO_IGNORE_FILES: currentValues.BLOG_REPO_IGNORE_FILES || answers.BLOG_REPO_IGNORE_FILES || '',
        BLOG_CUSTOM_PROMPT_FILE: currentValues.BLOG_CUSTOM_PROMPT_FILE || answers.BLOG_CUSTOM_PROMPT_FILE || ''
    };

    return finalConfig;
}

/**
 * Gets current environment values from process.env and CLI args
 */
export function getCurrentEnvValues(cliArgs: any): Partial<EnvironmentConfig> {
    return {
        AI_FOUNDRY_PROJECT_ENDPOINT: cliArgs.endpoint || process.env.AI_FOUNDRY_PROJECT_ENDPOINT,
        MODEL_DEPLOYMENT_NAME: cliArgs.deployment || process.env.MODEL_DEPLOYMENT_NAME,
        BLOG_REPO_URL: cliArgs.repoUrl || process.env.BLOG_REPO_URL,
        BLOG_REPO_NAME: cliArgs.repoName || process.env.BLOG_REPO_NAME,
        BLOG_REPO_IGNORE_FILES: cliArgs.ignoreFiles || process.env.BLOG_REPO_IGNORE_FILES,
        BLOG_CUSTOM_PROMPT_FILE: cliArgs.repoCustomPromptFile || process.env.BLOG_CUSTOM_PROMPT_FILE
    };
}
