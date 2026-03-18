/**
 * Load resolve.alias from Vite config (vite.config.ts, .js, .mjs, .cjs) for alias resolution.
 * Parses config file as text; supports object and array alias formats and common value patterns.
 */

import { readFileSync, existsSync } from 'fs';
import path from 'path';

export type ViteAliasEntry = { find: string; replacement: string };

const VITE_CONFIG_NAMES = ['vite.config.ts', 'vite.config.mts', 'vite.config.js', 'vite.config.mjs', 'vite.config.cjs'];

/** Find the extent of a balanced { ... } or [ ... ] starting at index i. Returns end index (exclusive) or -1. */
function findBalanced(content: string, start: number, open: '{' | '['): number {
    const close = open === '{' ? '}' : ']';
    let depth = 0;
    let i = start;
    const len = content.length;
    while (i < len) {
        const c = content[i];
        if (c === open) {
            depth++;
        } else if (c === close) {
            depth--;
            if (depth === 0) return i + 1;
        } else if ((c === '"' || c === "'" || c === '`') && depth > 0) {
            const q = c;
            i++;
            while (i < len && content[i] !== q) {
                if (content[i] === '\\') i++;
                i++;
            }
        }
        i++;
    }
    return -1;
}

/**
 * Parse alias block content and return list of { find, replacement }.
 * configDir is the directory of the config file (for resolving relative replacements).
 * projectRoot is used to resolve node_modules package paths.
 */
function parseAliasBlock(
    block: string,
    configDir: string,
    projectRoot: string
): ViteAliasEntry[] {
    const entries: ViteAliasEntry[] = [];
    const normalizedConfigDir = configDir || projectRoot;

    // Object form: key: value. Key is string or identifier.
    // Match key (quoted or ident) : value (several patterns)
    const keyPat = /(?:['"]([^'"]*)['"]|([a-zA-Z_$][a-zA-Z0-9_$]*))\s*:/g;
    let keyMatch;
    while ((keyMatch = keyPat.exec(block)) !== null) {
        const key = keyMatch[1] ?? keyMatch[2] ?? '';
        const valueStart = keyMatch.index + keyMatch[0].length;
        const rest = block.slice(valueStart);
        let replacement: string | null = null;

        // fileURLToPath(new URL('./src', import.meta.url)) or new URL('./src', import.meta.url)
        const fileURLMatch = rest.match(/^\s*fileURLToPath\s*\(\s*new\s+URL\s*\(\s*['"]([^'"]+)['"]/);
        if (fileURLMatch) {
            const rel = fileURLMatch[1].replace(/^\.\//, '');
            replacement = path.join(normalizedConfigDir, rel);
        }
        // path.resolve(__dirname, 'src') or path.join(__dirname, 'src')
        if (!replacement) {
            const pathMatch = rest.match(/^\s*path\.(?:resolve|join)\s*\(\s*__dirname\s*,\s*['"]([^'"]+)['"]/);
            if (pathMatch) {
                replacement = path.join(normalizedConfigDir, pathMatch[1]);
            }
        }
        // resolve(__dirname, 'src') (from "import { resolve } from 'path'")
        if (!replacement) {
            const resolveMatch = rest.match(/^\s*resolve\s*\(\s*__dirname\s*,\s*['"]([^'"]+)['"]/);
            if (resolveMatch) {
                replacement = path.join(normalizedConfigDir, resolveMatch[1]);
            }
        }
        // String literal: '...' or "..."
        if (!replacement) {
            const strMatch = rest.match(/^\s*['"]([^'"]*)['"]/);
            if (strMatch) {
                const val = strMatch[1];
                if (val.startsWith('@') && val.includes('/')) {
                    // Scoped package: '@dilitrust/design-system/src' -> node_modules/@dilitrust/design-system/src
                    const parts = val.split('/');
                    const pkg = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : val;
                    const sub = parts.length > 2 ? parts.slice(2).join('/') : '';
                    const pkgPath = sub
                        ? path.join(projectRoot, 'node_modules', pkg, sub)
                        : path.join(projectRoot, 'node_modules', pkg);
                    replacement = path.resolve(pkgPath);
                } else {
                    replacement = path.resolve(normalizedConfigDir, val);
                }
            }
        }

        if (replacement) {
            entries.push({ find: key, replacement });
        }
    }

    // Array form: { find: 'x', replacement: 'y' } or { find: "x", replacement: "y" }
    const arrayFindRe = /find\s*:\s*['"]([^'"]*)['"]\s*,\s*replacement\s*:\s*(?:path\.(?:resolve|join)\s*\(\s*__dirname\s*,\s*['"]([^'"]+)['"]\)|fileURLToPath\s*\(\s*new\s+URL\s*\(\s*['"]([^'"]+)['"]|['"]([^'"]*)['"])/g;
    let arrMatch;
    while ((arrMatch = arrayFindRe.exec(block)) !== null) {
        const find = arrMatch[1];
        const replFromPath = arrMatch[2];
        const replFromURL = arrMatch[3];
        const replFromStr = arrMatch[4];
        let replacement: string;
        if (replFromPath) {
            replacement = path.join(normalizedConfigDir, replFromPath);
        } else if (replFromURL) {
            replacement = path.join(normalizedConfigDir, replFromURL.replace(/^\.\//, ''));
        } else {
            const val = replFromStr ?? '';
            if (val.startsWith('@') && val.includes('/')) {
                const parts = val.split('/');
                const pkg = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : val;
                const sub = parts.length > 2 ? parts.slice(2).join('/') : '';
                replacement = path.resolve(
                    projectRoot,
                    'node_modules',
                    pkg,
                    ...(sub ? [sub] : [])
                );
            } else {
                replacement = path.resolve(normalizedConfigDir, val);
            }
        }
        entries.push({ find, replacement });
    }

    return entries;
}

/**
 * Find and load Vite resolve.alias from project root.
 * Returns list of { find, replacement } with replacement as absolute path.
 */
export function loadViteAliases(projectRoot: string): ViteAliasEntry[] {
    const configPath = VITE_CONFIG_NAMES.map((name) => path.join(projectRoot, name)).find((p) =>
        existsSync(p)
    );
    if (!configPath) return [];

    const content = readFileSync(configPath, 'utf-8');
    const configDir = path.dirname(configPath);

    const aliasSection = content.indexOf('resolve');
    if (aliasSection === -1) return [];
    const aliasIndex = content.indexOf('alias', aliasSection);
    if (aliasIndex === -1) return [];

    let i = aliasIndex + 5;
    while (i < content.length && /[\s:]/.test(content[i])) i++;
    if (content[i] !== ':') return [];
    i++;
    while (i < content.length && /\s/.test(content[i])) i++;
    const open = content[i];
    if (open !== '{' && open !== '[') return [];
    const end = findBalanced(content, i, open as '{' | '[');
    if (end === -1) return [];

    const block = content.slice(i + 1, end - 1);
    return parseAliasBlock(block, configDir, projectRoot);
}

/**
 * Resolve a specifier using Vite alias entries.
 * find can be '@' or '@ds'; specifier like '@/foo' or '@ds/bar' is matched by prefix.
 */
export function resolveWithViteAliases(
    specifier: string,
    aliases: ViteAliasEntry[]
): string | null {
    for (const { find, replacement } of aliases) {
        const rest = specifier === find ? '' : specifier.startsWith(find + '/') ? specifier.slice(find.length) : null;
        if (rest === null && specifier !== find) continue;
        const suffix = rest === '' ? '' : rest.startsWith('/') ? rest : '/' + rest;
        const resolved = replacement.endsWith('/') ? replacement.slice(0, -1) + suffix : replacement + suffix;
        return path.normalize(resolved);
    }
    return null;
}
