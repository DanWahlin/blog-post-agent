import { runCli, type CliOptions } from 'repomix';
import fs from 'fs';
import path from 'path';

export async function getAssistantMessage(messagesIterator: AsyncIterable<any>): Promise<any | null> {
    for await (const m of messagesIterator) {
        if (m.role === 'assistant') {
            return m;
        }
    }
    return null;
}

export function getAssistantMessageContent(message: any): string | null {
    if (!message || !Array.isArray(message.content)) {
        return null;
    }
    let output: string = message.content.map((c: any) => {
        if (typeof c.text === 'object' && c.text.value) {
            return c.text.value;
        } else if (typeof c.text === 'string') {
            return c.text;
        } else {
            return JSON.stringify(c);
        }
    }).join('');
    if (typeof output !== 'string') {
        return null;
    }
    return output;
}

export function saveBlogPostToFile(message: any, filePath: string): void {
    const output = getAssistantMessageContent(message);
    if (!output) {
        console.error('No assistant message found or content is not in expected format.');
        return;
    }
    // Ensure the directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, output, 'utf8');
    console.log(`Blog post saved to ${filePath}`);
}

export function isMarkdown(content: string | null): boolean {
    if (!content) return false;
    // Check for common markdown features and minimum length
    return (/^\s*#|^\s*---|^\s*\*|^\s*\d+\.|^\s*>|^\s*```/m.test(content) && content.trim().length > 200);
}

export async function processRemoteRepo(repoUrl: string, outputFile: string): Promise<unknown> {
    const ignoreFiles = process.env.BLOG_REPO_IGNORE_FILES ? process.env.BLOG_REPO_IGNORE_FILES : '';

    const options: CliOptions = {
        style: 'markdown',
        remote: repoUrl,
        output: outputFile,
        compress: true,
        ignore: ignoreFiles
    };
    return await runCli(['.'], process.cwd(), options);
}
