import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DefaultAzureCredential } from '@azure/identity';
import { ToolUtility, DoneEvent, ErrorEvent } from '@azure/ai-agents';
import { AIProjectClient } from '@azure/ai-projects';
import { config } from 'dotenv';
import { getAssistantMessage, getAssistantMessageContent, saveBlogPostToFile, isMarkdown, processRemoteRepo } from './utils.js';
config();

const prompt = `
You are an expert technical blogger who specializes in spotlighting open-source 
AI projects. Using the following ## Repo Information, write a blog post 
titled “AI Repo of the Week: [Name of Repo]” that includes: 

1. Introduction (2–3 paragraphs): 

    - Summarize the repo’s purpose, its key benefits, and who it’s for. 
    - Suggest 1–2 standout images (e.g. screenshots, architecture diagrams) from the repo to use as a header. 
    - End with a strong call to action inviting readers to explore the repo. 

2. Key Features & Learning Journey: 

    - Break down the repo’s main features in a logical “getting-started” sequence. 
    - For code-focused demos, highlight the top 2–3 code snippets or examples that showcase functionality. 
    - Use subheadings or numbered steps to guide readers through exploring the code. 

3. Conclusion & Call to Action: 

    - Recap why this repo matters and what readers will gain. 
    - Encourage them to visit, star, and contribute to the project. 

Tone & Style: 

    - Professional yet engaging, with clear headings for easy skimming. 
    - SEO-friendly (include “AI” and “GitHub” where natural).
    - Optimized for social sharing (concise, action-oriented language).

IMPORTANT:
    - You have access to the uploaded file via the FileSearch tool. Use it to answer all questions about the repo.
    - Output the blog post as markdown.

## Repo Information

Use the uploaded file as the source for ## Repo Information.
`;

await runBlogAgent().catch(console.error);

async function runBlogAgent() {
    const endpoint = process.env.PROJECT_ENDPOINT;
    const deployment = process.env.MODEL_DEPLOYMENT_NAME || 'gpt-4o';
    const blogRepoUrl = process.env.BLOG_REPO_URL;
    const blogRepoName = process.env.BLOG_REPO_NAME;
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
        await processRemoteRepo(blogRepoUrl, path.join(__dirname, repoDataFilePath));

        // Upload a repomix blog file
        console.log(`\n==================== 🕵️  BLOG POST AGENT ====================`);
        const client: AIProjectClient = new AIProjectClient(endpoint, new DefaultAzureCredential());
        const file = await client.agents.files.upload(
            fs.createReadStream(path.join(__dirname, repoDataFilePath)),
            'assistants',
            { fileName: normalizedFileName }
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
            saveBlogPostToFile(fileAssistantMessage, generatedBlogFilePath);
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
