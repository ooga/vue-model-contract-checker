/**
 * SFC Parser – uses @vue/compiler-sfc to parse .vue files and extract script/template.
 */

import { parse } from '@vue/compiler-sfc';
import type { ComponentInfo } from './types.js';
import { extractModelProps } from './modelExtractor.js';
import { extractComponentImports, unresolvedRawToFull } from './importExtractor.js';
import type { TsconfigPaths } from './tsconfigPaths.js';
import type { ViteAliasEntry } from './viteConfig.js';
import type { UnresolvedImport } from './types.js';
import path from 'path';

export function parseSFC(
    source: string,
    filePath: string,
    filename?: string,
    projectRoot?: string,
    tsconfigPaths?: TsconfigPaths | null,
    viteAliases?: ViteAliasEntry[]
): { component: ComponentInfo; errors: unknown[]; unresolvedImports: UnresolvedImport[] } {
    const name = path.basename(filePath, path.extname(filePath));
    const { descriptor, errors } = parse(source, {
        filename: filename ?? filePath,
        sourceMap: false,
    });

    const scriptContent =
        descriptor.scriptSetup?.content ?? descriptor.script?.content ?? '';
    const modelProps = extractModelProps(scriptContent);
    const { imports, unresolved: unresolvedRaw } = extractComponentImports(
        scriptContent,
        filePath,
        projectRoot,
        tsconfigPaths,
        viteAliases
    );
    const unresolvedImports: UnresolvedImport[] = unresolvedRawToFull(
        filePath,
        scriptContent,
        unresolvedRaw
    );

    const template = descriptor.template;
    const templateContent = template?.content ?? null;
    const templateStartLine = template?.loc?.start?.line;

    const component: ComponentInfo = {
        name,
        filePath,
        imports,
        modelProps,
        templateContent,
        templateStartLine,
    };

    return { component, errors, unresolvedImports };
}
