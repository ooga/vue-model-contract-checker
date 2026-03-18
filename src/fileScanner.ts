/**
 * File Scanner – discovers all .vue files matching include/exclude patterns.
 */

import { glob } from 'glob';
import path from 'path';
import type { FileEntry } from './types.js';

export async function scanFiles(
    projectRoot: string,
    include: string[],
    exclude: string[]
): Promise<FileEntry[]> {
    const ignore = exclude.length > 0 ? exclude : ['**/node_modules/**', '**/dist/**'];
    const files: FileEntry[] = [];
    const cwd = projectRoot;

    for (const pattern of include) {
        const matches = await glob(pattern, { cwd, ignore, nodir: true });
        for (const match of matches) {
            const absolutePath = path.resolve(cwd, match);
            files.push({ path: absolutePath });
        }
    }

    return files;
}
