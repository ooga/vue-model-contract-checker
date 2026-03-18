/**
 * Load baseUrl and paths from tsconfig.json / jsconfig.json for alias resolution.
 * Supports path mapping with * wildcard; follows "references" when root has no paths.
 */

import { readFileSync, existsSync } from 'fs';
import path from 'path';

export type TsconfigPaths = {
    baseUrl: string;
    paths: Record<string, string[]>;
    configDir: string;
};

/** Strip JSONC comments so we can parse tsconfig that may contain comments. */
function stripJsonComments(json: string): string {
    return json
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '');
}

function parseJsonSafe(filePath: string): Record<string, unknown> | null {
    try {
        const raw = readFileSync(filePath, 'utf-8');
        const stripped = stripJsonComments(raw);
        return JSON.parse(stripped) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function getCompilerOptions(obj: Record<string, unknown>): Record<string, unknown> | undefined {
    const co = obj.compilerOptions;
    return co && typeof co === 'object' && !Array.isArray(co) ? (co as Record<string, unknown>) : undefined;
}

/**
 * Find and load tsconfig.json or jsconfig.json from project root.
 * If the root config has "references" but no paths, try the first referenced config (e.g. tsconfig.app.json).
 */
export function loadTsconfigPaths(projectRoot: string): TsconfigPaths | null {
    const configPath = [
        path.join(projectRoot, 'tsconfig.json'),
        path.join(projectRoot, 'jsconfig.json'),
    ].find((p) => existsSync(p));

    if (!configPath) return null;

    const configDir = path.dirname(configPath);
    let config = parseJsonSafe(configPath);
    if (!config) return null;

    const co = getCompilerOptions(config);
    let baseUrl = (co?.baseUrl as string | undefined) ?? '.';
    let paths = co?.paths as Record<string, string[]> | undefined;

    let resolvedConfigDir = configDir;

    if (!paths && config.references && Array.isArray(config.references)) {
        for (const ref of config.references as { path?: string }[]) {
            if (!ref?.path) continue;
            const refPath = path.resolve(configDir, ref.path);
            const refConfig = parseJsonSafe(refPath);
            if (!refConfig) continue;
            const refCo = getCompilerOptions(refConfig);
            if (refCo?.paths) {
                resolvedConfigDir = path.dirname(refPath);
                baseUrl = (refCo.baseUrl as string | undefined) ?? '.';
                paths = refCo.paths as Record<string, string[]>;
                break;
            }
        }
    }

    if (!paths || typeof paths !== 'object') return null;

    const absoluteBaseUrl = path.resolve(resolvedConfigDir, baseUrl);
    return {
        baseUrl: absoluteBaseUrl,
        paths,
        configDir: resolvedConfigDir,
    };
}

/**
 * Turn a path pattern like "@/*" into a regex that captures the segment matched by *.
 * Pattern must contain exactly one *.
 */
function patternToRegex(pattern: string): { regex: RegExp; starIndex: number } | null {
    const starIndex = pattern.indexOf('*');
    if (starIndex === -1 || pattern.indexOf('*', starIndex + 1) !== -1) return null;
    const before = pattern.slice(0, starIndex).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const after = pattern.slice(starIndex + 1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${before}(.*)${after}$`);
    return { regex, starIndex };
}

/**
 * Resolve an import specifier using TypeScript paths.
 * Returns absolute path if the specifier matches a path mapping and the resolved path exists (or for .vue we don't check existence).
 */
export function resolveWithPaths(
    specifier: string,
    tsconfig: TsconfigPaths
): string | null {
    const { baseUrl, paths } = tsconfig;
    for (const [pattern, targets] of Object.entries(paths)) {
        if (!Array.isArray(targets) || targets.length === 0) continue;
        const parsed = patternToRegex(pattern);
        if (!parsed) continue;
        const match = specifier.match(parsed.regex);
        if (!match) continue;
        const starValue = match[1];
        const target = targets[0];
        if (!target.includes('*')) continue;
        const substituted = target.replace(/\*/g, starValue);
        const absolute = path.resolve(baseUrl, substituted);
        return absolute;
    }
    return null;
}
