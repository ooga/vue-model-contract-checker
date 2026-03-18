/**
 * Main checker: scan → parse → register → analyze usage → report.
 */

import { readFileSync } from 'fs';
import { scanFiles } from './fileScanner.js';
import { parseSFC } from './sfcParser.js';
import * as registry from './componentRegistry.js';
import { analyzeTemplate } from './templateAnalyzer.js';
import { reportCli, reportJson, reportStats } from './reporter.js';
import { loadTsconfigPaths } from './tsconfigPaths.js';
import { loadViteAliases } from './viteConfig.js';
import type { CheckerConfig, UnresolvedImport, Violation } from './types.js';

const DISABLE_NEXT_LINE = 'vue-model-contract-checker-disable-next-line';

function filterViolationsWithDisableComment(violations: Violation[]): Violation[] {
    const fileLinesCache = new Map<string, string[]>();
    function getLines(filePath: string): string[] {
        let lines = fileLinesCache.get(filePath);
        if (lines === undefined) {
            try {
                const content = readFileSync(filePath, 'utf-8');
                lines = content.split(/\r?\n/);
            } catch {
                lines = [];
            }
            fileLinesCache.set(filePath, lines);
        }
        return lines;
    }
    return violations.filter((v) => {
        const lineIndex = v.line - 1;
        if (lineIndex <= 0) return true;
        const lines = getLines(v.file);
        const precedingLine = lines[lineIndex - 1];
        return !precedingLine?.includes(DISABLE_NEXT_LINE);
    });
}

export type RunOptions = {
    outputJson?: boolean;
    stats?: boolean;
    debug?: boolean;
    failOnError?: boolean;
    /** When true, print each unresolved import; when false, only mention the count. */
    showUnresolved?: boolean;
};

export async function run(
    config: CheckerConfig,
    options: RunOptions = {}
): Promise<{ violations: Violation[]; unresolvedImports: UnresolvedImport[]; componentCount: number }> {
    const {
        include,
        exclude,
        projectRoot,
    } = config;

    // 1. File Scanner
    const fileEntries = await scanFiles(projectRoot, include, exclude);
    const vueFiles = fileEntries.map((e) => e.path);

    // 2. Load tsconfig paths and Vite resolve.alias for alias resolution
    const tsconfigPaths = loadTsconfigPaths(projectRoot);
    const viteAliases = loadViteAliases(projectRoot);

    // 3. SFC Parse + Component Registry (single pass)
    registry.clearRegistry();
    const allUnresolved: UnresolvedImport[] = [];
    for (const filePath of vueFiles) {
        try {
            const source = readFileSync(filePath, 'utf-8');
            const { component, unresolvedImports } = parseSFC(
                source,
                filePath,
                undefined,
                projectRoot,
                tsconfigPaths,
                viteAliases
            );
            registry.registerComponent(component);
            allUnresolved.push(...unresolvedImports);
        } catch {
            // Skip unreadable or invalid SFCs
        }
    }

    const componentCount = registry.getAllComponents().length;

    if (options.debug) {
        console.log('[debug] Component graph:');
        for (const c of registry.getAllComponents()) {
            const models = Array.from(c.modelProps).join(', ') || '(none)';
            console.log(`  ${c.filePath} → modelProps: { ${models} }`);
        }
    }

    // 4. Usage analysis (second pass)
    const violations: Violation[] = [];
    const resolveComponent = registry.resolveComponent.bind(registry);
    for (const filePath of vueFiles) {
        const info = registry.getComponentByPath(filePath);
        if (!info?.templateContent) continue;
        const fileViolations = analyzeTemplate(
            filePath,
            info.templateContent,
            resolveComponent,
            info.templateStartLine
        );
        violations.push(...fileViolations);
    }

    const filteredViolations = filterViolationsWithDisableComment(violations);

    // 5. Report
    if (options.outputJson) {
        console.log(reportJson(filteredViolations, allUnresolved));
    } else {
        reportCli(filteredViolations, allUnresolved, options.showUnresolved === true);
        if (options.stats) {
            reportStats(componentCount, filteredViolations.length, allUnresolved.length);
        }
    }

    const hasErrors = filteredViolations.length > 0 || allUnresolved.length > 0;
    if (config.failOnError && hasErrors) {
        process.exitCode = 1;
    }

    return { violations: filteredViolations, unresolvedImports: allUnresolved, componentCount };
}
