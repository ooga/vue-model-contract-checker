/**
 * Extracts component imports from script content.
 * Supports relative paths (./ or ../), tsconfig paths, and Vite resolve.alias.
 * Non-relative .vue imports that don't match any mapping are returned as unresolved.
 */

import path from 'path';
import type { UnresolvedImport } from './types.js';
import type { TsconfigPaths } from './tsconfigPaths.js';
import type { ViteAliasEntry } from './viteConfig.js';
import { resolveWithPaths } from './tsconfigPaths.js';
import { resolveWithViteAliases } from './viteConfig.js';

export type UnresolvedImportRaw = { specifier: string; offset: number };

/** import Default from './path.vue' or import Default from "../path.vue" (relative only) */
const IMPORT_DEFAULT_RE =
    /import\s+(\w+)\s+from\s+['"](\.\.?\/[^'"]+\.vue)['"]/g;
/** import { A, B } from './path.vue' - each export is a component name */
const IMPORT_NAMED_RE =
    /import\s+\{([^}]+)\}\s+from\s+['"](\.\.?\/[^'"]+\.vue)['"]/g;
/** import Default from 'any/specifier.vue' (non-relative; for alias resolution) */
const IMPORT_ALIAS_DEFAULT_RE =
    /import\s+(\w+)\s+from\s+['"]([^'"]+\.vue)['"]/g;
/** import { A, B } from 'any/specifier.vue' */
const IMPORT_ALIAS_NAMED_RE =
    /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+\.vue)['"]/g;

function offsetToLineColumn(content: string, offset: number): { line: number; column: number } {
    let line = 1;
    let column = 0;
    for (let i = 0; i < content.length && i < offset; i++) {
        if (content[i] === '\n') {
            line++;
            column = 0;
        } else {
            column++;
        }
    }
    return { line, column };
}

export function extractComponentImports(
    scriptContent: string,
    filePath: string,
    projectRoot?: string,
    tsconfigPaths?: TsconfigPaths | null,
    viteAliases?: ViteAliasEntry[]
): { imports: Record<string, string>; unresolved: UnresolvedImportRaw[] } {
    const dir = path.dirname(filePath);
    const imports: Record<string, string> = {};
    const unresolved: UnresolvedImportRaw[] = [];

    const resolveAlias = (specifier: string): string | null => {
        if (tsconfigPaths) {
            const resolved = resolveWithPaths(specifier, tsconfigPaths);
            if (resolved) return resolved;
        }
        if (viteAliases && viteAliases.length > 0) {
            const resolved = resolveWithViteAliases(specifier, viteAliases);
            if (resolved) return resolved;
        }
        return null;
    };

    let m: RegExpExecArray | null;

    // Relative imports
    const defaultRe = new RegExp(IMPORT_DEFAULT_RE.source, 'g');
    while ((m = defaultRe.exec(scriptContent)) !== null) {
        const localName = m[1];
        const relativePath = m[2];
        const absolutePath = path.resolve(dir, relativePath);
        imports[localName] = absolutePath;
    }

    const namedRe = new RegExp(IMPORT_NAMED_RE.source, 'g');
    while ((m = namedRe.exec(scriptContent)) !== null) {
        const names = m[1].split(',').map((n) => n.trim().split(/\s+as\s+/).pop()?.trim() ?? n.trim());
        const relativePath = m[2];
        const absolutePath = path.resolve(dir, relativePath);
        for (const name of names) {
            if (name) imports[name] = absolutePath;
        }
    }

    // Non-relative (alias) imports – resolve via tsconfig or record as unresolved
    const aliasDefaultRe = new RegExp(IMPORT_ALIAS_DEFAULT_RE.source, 'g');
    while ((m = aliasDefaultRe.exec(scriptContent)) !== null) {
        const specifier = m[2];
        if (specifier.startsWith('./') || specifier.startsWith('../')) continue;
        const absolutePath = resolveAlias(specifier);
        if (absolutePath) {
            imports[m[1]] = absolutePath;
        } else {
            unresolved.push({ specifier, offset: m.index });
        }
    }

    const aliasNamedRe = new RegExp(IMPORT_ALIAS_NAMED_RE.source, 'g');
    while ((m = aliasNamedRe.exec(scriptContent)) !== null) {
        const specifier = m[2];
        if (specifier.startsWith('./') || specifier.startsWith('../')) continue;
        const absolutePath = resolveAlias(specifier);
        if (absolutePath) {
            const names = m[1].split(',').map((n) => n.trim().split(/\s+as\s+/).pop()?.trim() ?? n.trim());
            for (const name of names) {
                if (name) imports[name] = absolutePath;
            }
        } else {
            unresolved.push({ specifier, offset: m.index });
        }
    }

    return { imports, unresolved };
}

export function unresolvedRawToFull(
    filePath: string,
    scriptContent: string,
    raw: UnresolvedImportRaw[]
): UnresolvedImport[] {
    return raw.map(({ specifier, offset }) => {
        const { line, column } = offsetToLineColumn(scriptContent, offset);
        return {
            file: filePath,
            line,
            column,
            specifier,
            message: `Could not resolve "${specifier}" (no tsconfig paths or no matching path mapping).`,
        };
    });
}
