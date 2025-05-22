import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DefaultAzureCredential } from '@azure/identity';
import { ToolUtility, DoneEvent, ErrorEvent } from '@azure/ai-agents';
import { AIProjectClient } from '@azure/ai-projects';
import { config } from 'dotenv';
import { getAssistantMessage, getAssistantMessageContent, saveBlogPostToFile, isMarkdown, processRemoteRepo, ensureFreshFile, extractIntroductionSection } from './utils.js';
import { argv } from './cliArgs.js';
config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prompt = fs.readFileSync(path.join(__dirname, 'prompt.md'), 'utf8');

await runBlogAgent().catch(console.error);

async function runBlogAgent() {
    const endpoint = process.env.PROJECT_ENDPOINT;
    const deployment = process.env.MODEL_DEPLOYMENT_NAME || 'gpt-4o';
    const blogRepoUrl = argv.repoUrl || process.env.BLOG_REPO_URL;
    const blogRepoName = argv.repoName || process.env.BLOG_REPO_NAME;
    const blogRepoIgnoreFiles = argv.ignoreFiles || process.env.BLOG_REPO_IGNORE_FILES || '';
    if (!endpoint) {
        throw new Error('PROJECT_ENDPOINT environment variable is not set.');
    }
    if (!blogRepoUrl) {
        throw new Error('BLOG_REPO_URL environment variable is not set.');
    }
    if (!blogRepoName) {
        throw new Error('BLOG_REPO_NAME environment variable is not set.');
    }
    const normalizedFileName = blogRepoName.toLowerCase().replace(/\s+/g, '-');
    const baseFilesPath = '../data'
    const repoDataFilePath = `${baseFilesPath}/repos/${normalizedFileName}.md`;
    const generatedBlogFilePath = `${baseFilesPath}/blogs/${normalizedFileName}.md`;
    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    try {
        // Create blog post repomix
        const repoDataFullPath = path.join(__dirname, repoDataFilePath);
        await ensureFreshFile(
            repoDataFullPath,
            60,
            async () => {
                await processRemoteRepo(blogRepoUrl, repoDataFullPath);
            }
        );

        // Upload a repomix blog file
        console.log(`\n==================== 🕵️  BLOG POST AGENT ====================`);
        const client: AIProjectClient = new AIProjectClient(endpoint, new DefaultAzureCredential());
        console.log(`\n---------------- 🗂️ Uploading File ----------------`);
        const file = await client.agents.files.upload(
            fs.createReadStream(path.join(__dirname, repoDataFilePath)),
            'assistants',
            { fileName: `${normalizedFileName}.md` }
        );
        console.log(`Uploaded file, ID: ${file.id}`);
        const vectorStore = await client.agents.vectorStores.create({
            fileIds: [file.id],
            name: 'my_vectorstore'
        });
        console.log('\n---------------- 🗃️ Vector Store Info ----------------');
        console.table([
            {
                'Vector Store ID': vectorStore.id,
                'Usage (bytes)': vectorStore.usageBytes,
                'File Count': vectorStore.fileCounts?.total ?? 'N/A'
            }
        ]);

        // Create an Agent and a FileSearch tool
        const fileSearchTool = ToolUtility.createFileSearchTool([vectorStore.id]);
        const fileAgent = await client.agents.createAgent(deployment, {
            name: 'my-file-agent',
            instructions: 'You are a helpful technical blog writing assistant and can search information from uploaded files',
            tools: [fileSearchTool.definition],
            toolResources: fileSearchTool.resources,
        });

        // Create a thread and message
        const fileSearchThread = await client.agents.threads.create({ toolResources: fileSearchTool.resources });
        console.log(`\n---------------- 📝 User Prompt ---------------- \n`);
        await client.agents.messages.create(
            fileSearchThread.id,
            'user',
            prompt
        );

        // Create run
        let fileSearchRun = await client.agents.runs.create(fileSearchThread.id, fileAgent.id).stream();

        for await (const eventMessage of fileSearchRun) {
            if (eventMessage.event === DoneEvent.Done) {
                console.log(`Run completed: ${eventMessage.data}`);
            }
            if (eventMessage.event === ErrorEvent.Error) {
                console.log(`An error occurred. ${eventMessage.data}`);
            }
        }

        const fileSearchMessagesIterator = await client.agents.messages.list(fileSearchThread.id);
        const fileAssistantMessage = await getAssistantMessage(fileSearchMessagesIterator);
        console.log(`\n---------------- 💬 Response ---------------- \n`);
        const blogContent = getAssistantMessageContent(fileAssistantMessage);
        if (isMarkdown(blogContent)) {
            saveBlogPostToFile(fileAssistantMessage, path.join(__dirname, generatedBlogFilePath));
            // Print the Introduction section to the console
            if (blogContent) {
                const intro = extractIntroductionSection(blogContent);
                if (intro) {
                    console.log('\n---------------- 📢 Introduction Section ----------------\n');
                    console.log(intro);
                } else {
                    console.log('Introduction section not found in the blog post.');
                }
            }
        } else {
            console.warn('Agent response does not appear to be valid markdown or is too short. Not saving to file.');
            if (blogContent) {
                console.log('Agent response preview:', blogContent.slice(0, 500));
            }
        }

        // Clean up
        console.log(`\n---------------- 🧹 Clean Up File Agent ----------------`);
        await client.agents.vectorStores.delete(vectorStore.id);
        await client.agents.files.delete(file.id);
        await client.agents.deleteAgent(fileAgent.id);
        console.log(`Deleted VectorStore, File, and FileAgent. FileAgent ID: ${fileAgent.id}`);
    } catch (err) {
        console.error('Error in runAgents:', err);
        throw err;
    }
}

if (argv.help || argv.h) {
    console.log(`\nUsage: node src/index.js [options]\n\nOptions:\n  --repoUrl       GitHub repo URL\n  --repoName      Repo display name\n  --ignoreFiles   Glob patterns for files to ignore\n  -h, --help      Show this help message\n\nExample:\n  node src/index.js --repoUrl=https://github.com/microsoft/mcp-for-beginners --repoName="MCP for Beginners" --ignoreFiles="**/translations/*,**/translated_images/*"\n`);
    process.exit(0);
}
