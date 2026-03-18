/**
 * Reporter – outputs violations and unresolved imports in CLI and optional JSON format.
 */

import type { UnresolvedImport, Violation } from './types.js';

const PREFIX = '[vue-model-contract-checker]';

export function reportCli(
    violations: Violation[],
    unresolvedImports: UnresolvedImport[] = [],
    showUnresolvedDetails: boolean = false
): void {
    if (violations.length === 0 && unresolvedImports.length === 0) return;
    console.log(`\n${PREFIX}\n`);
    for (const v of violations) {
        console.log(`${v.file}:${v.line}:${v.column}`);
        console.log(`❌ ${v.component} → prop "${v.prop}" is a v-model contract`);
        console.log(`   ${v.message}\n`);
    }
    if (unresolvedImports.length > 0) {
        if (showUnresolvedDetails) {
            for (const u of unresolvedImports) {
                console.log(`${u.file}:${u.line}:${u.column}`);
                console.log(`❌ Unresolved import: "${u.specifier}"`);
                console.log(`   ${u.message}\n`);
            }
        } else {
            console.log(`❌ ${unresolvedImports.length} unresolved import(s). Use --show-unresolved to list them.\n`);
        }
    }
}

export function reportJson(
    violations: Violation[],
    unresolvedImports: UnresolvedImport[] = []
): string {
    return JSON.stringify(
        {
            violations: violations.map((v) => ({
                file: v.file,
                line: v.line,
                column: v.column,
                component: v.component,
                prop: v.prop,
                message: v.message,
            })),
            unresolvedImports: unresolvedImports.map((u) => ({
                file: u.file,
                line: u.line,
                column: u.column,
                specifier: u.specifier,
                message: u.message,
            })),
        },
        null,
        2
    );
}

export function reportStats(
    totalComponents: number,
    violationCount: number,
    unresolvedCount: number = 0
): void {
    console.log(`✔ ${totalComponents} components analyzed`);
    const errorCount = violationCount + unresolvedCount;
    if (errorCount > 0) {
        const parts = [];
        if (violationCount > 0) parts.push(`${violationCount} violations`);
        if (unresolvedCount > 0) parts.push(`${unresolvedCount} unresolved import(s)`);
        console.log(`❌ ${parts.join(', ')} found`);
    } else {
        console.log(`✔ No violations found`);
    }
}
