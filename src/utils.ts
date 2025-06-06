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

export async function processRemoteRepo(repoUrl: string, outputFile: string, blogRepoIgnoreFiles: string): Promise<unknown> {

    let repoPathConfig: {
        remote?: string;
        branch?: string;
        include?: string;
    } = {}
    if (repoUrl.startsWith('https://')) {
        repoPathConfig = {
            remote: repoUrl,
            branch: 'main'
        };
    }
    else if (repoUrl.startsWith('/') || repoUrl.startsWith('.') || repoUrl.startsWith('~/') || repoUrl.startsWith('\\')) {
        repoPathConfig = {
            include: repoUrl,
        };
    }

    const options: CliOptions = {
        style: 'markdown',
        output: outputFile,
        compress: true,
        ignore: blogRepoIgnoreFiles,
        ...repoPathConfig
    };
    return await runCli(['.'], repoPathConfig.include ? repoPathConfig.include : process.cwd(), options);
}

/**
 * Checks if a file exists and is less than maxAgeMinutes old. If so, returns true. Otherwise, calls the fetchFn to (re)create the file and returns false.
 */
export async function ensureFreshFile(filePath: string, maxAgeMinutes: number, fetchFn: () => Promise<void>): Promise<boolean> {
    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const now = Date.now();
        const mtime = stats.mtime.getTime();
        const ageMinutes = (now - mtime) / (1000 * 60);
        if (ageMinutes <= maxAgeMinutes) {
            console.log(`Using existing file: ${filePath} (age: ${ageMinutes.toFixed(1)} min)`);
            return true;
        } else {
            console.log(`File is older than ${maxAgeMinutes} minutes. Will refresh: ${filePath}`);
        }
    }
    await fetchFn();
    return false;
}

export function extractIntroductionSection(markdown: string): string | null {
    const introMatch = markdown.match(/## Introduction[\r\n]+([\s\S]*?)(?=^## |\Z)/m);
    if (introMatch && introMatch[1]) {
        return introMatch[1].trim();
    }
    return null;
}
