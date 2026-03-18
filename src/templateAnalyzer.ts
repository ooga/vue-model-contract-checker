/**
 * Template Analyzer – parses template AST and detects v-model contract violations.
 * Uses @vue/compiler-dom for parsing. For each component usage, checks that
 * model props are used only via v-model / v-model:prop, not :prop.
 */

import { parse, type RootNode, type ElementNode, type DirectiveNode, NodeTypes } from '@vue/compiler-dom';
import type { ComponentInfo } from './types.js';
import type { Violation } from './types.js';

const BIND = 'bind';
const MODEL = 'model';
const ON = 'on';
const UPDATE_PREFIX = 'update:';

/** Vue templates use kebab-case; script uses camelCase. Normalize for comparison. */
function kebabToCamel(kebab: string): string {
    return kebab.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/** Check if template binding prop (e.g. matter-input) is a model prop (e.g. matterInput). */
function isModelProp(templatePropName: string, modelProps: Set<string>): boolean {
    return (
        modelProps.has(templatePropName) ||
        modelProps.has(kebabToCamel(templatePropName))
    );
}

function getStaticArgContent(arg: { type: number; content?: string } | undefined): string | null {
    if (!arg) return null;
    if (arg.type === NodeTypes.SIMPLE_EXPRESSION && typeof (arg as { content?: string }).content === 'string') {
        return (arg as { content: string }).content;
    }
    return null;
}

function walkTemplate(
    templateContent: string,
    filePath: string,
    resolveComponentFn: (tag: string, fromFilePath: string) => ComponentInfo | undefined,
    violations: Violation[],
    templateStartLine?: number
): void {
    let ast: RootNode;
    try {
        ast = parse(templateContent, { onError: () => {} });
    } catch {
        return;
    }

    function getLineCol(offset: number): { line: number; column: number } {
        let line = 1;
        let column = 0;
        for (let i = 0; i < templateContent.length && i < offset; i++) {
            if (templateContent[i] === '\n') {
                line++;
                column = 0;
            } else {
                column++;
            }
        }
        return { line, column };
    }

    function visit(node: unknown): void {
        if (!node || typeof node !== 'object') return;
        const n = node as { type?: number; tag?: string; tagType?: number; props?: unknown[]; children?: unknown[] };
        if (n.type === NodeTypes.ELEMENT && n.tag && n.props) {
            const tag = n.tag;
            // Vue convention: components are PascalCase or kebab-case (resolved to PascalCase)
            const isPascalCase = tag.length > 0 && tag[0] === tag[0].toUpperCase();
            const componentTag = isPascalCase ? tag : (tag.includes('-') ? tag.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join('') : tag);
            const component = resolveComponentFn(componentTag, filePath);
            if (component && component.modelProps.size > 0) {
                const propsList = n.props as Array<AttributeNode | DirectiveNode>;
                // Collect props that have an explicit @update:prop listener (equivalent to v-model:prop)
                const hasUpdateListener = new Set<string>();
                for (const prop of propsList) {
                    if (prop.type === NodeTypes.DIRECTIVE) {
                        const dir = prop as DirectiveNode;
                        if (dir.name === ON) {
                            const argContent = getStaticArgContent(dir.arg as { type: number; content?: string } | undefined);
                            if (argContent?.startsWith(UPDATE_PREFIX)) {
                                const propName = argContent.slice(UPDATE_PREFIX.length);
                                hasUpdateListener.add(propName);
                                hasUpdateListener.add(kebabToCamel(propName));
                            }
                        }
                    }
                }
                const invalidBindings: { prop: string; loc: { line: number; column: number } }[] = [];
                for (const prop of propsList) {
                    if (prop.type === NodeTypes.DIRECTIVE) {
                        const dir = prop as DirectiveNode;
                        if (dir.name === MODEL) {
                            // v-model / v-model:prop – valid, skip
                        } else if (dir.name === BIND) {
                            const argContent = getStaticArgContent(dir.arg as { type: number; content?: string } | undefined);
                            if (argContent && isModelProp(argContent, component.modelProps)) {
                                const propCamel = kebabToCamel(argContent);
                                if (hasUpdateListener.has(argContent) || hasUpdateListener.has(propCamel)) {
                                    continue; // :prop + @update:prop is equivalent to v-model:prop
                                }
                                const loc = dir.loc &&
                                    'start' in dir.loc &&
                                    typeof (dir.loc.start as { line?: number; column?: number; offset?: number }).line === 'number'
                                    ? {
                                          line: (dir.loc.start as { line: number }).line,
                                          column: (dir.loc.start as { column: number }).column,
                                      }
                                    : getLineCol((dir.loc as { start?: { offset: number } })?.start?.offset ?? 0);
                                invalidBindings.push({ prop: argContent, loc });
                            }
                        }
                    }
                }
                const lineOffset = templateStartLine != null ? templateStartLine - 1 : 0;
                for (const { prop, loc } of invalidBindings) {
                    violations.push({
                        file: filePath,
                        line: lineOffset + loc.line,
                        column: loc.column,
                        component: tag,
                        prop,
                        message: `Use "v-model:${prop}" instead of ":${prop}"`,
                    });
                }
            }
            if (n.children && Array.isArray(n.children)) {
                for (const child of n.children) visit(child);
            }
        } else if (n.type === NodeTypes.ROOT && Array.isArray((n as RootNode).children)) {
            for (const child of (n as RootNode).children) visit(child);
        } else if (n.children && Array.isArray(n.children)) {
            for (const child of n.children) visit(child);
        }
    }

    visit(ast);
}

// Minimal types for Vue AST (we only use a subset)
type AttributeNode = { type: number; name: string };
type DirectiveNode = {
    type: number;
    name: string;
    arg?: { type: number; content?: string };
    loc?: { start: { offset: number; line?: number; column?: number }; end: { offset: number } };
};

/**
 * Analyze a single file's template and collect violations.
 * templateStartLine: 1-based file line where template content starts (for source line numbers).
 */
export function analyzeTemplate(
    filePath: string,
    templateContent: string,
    resolveComponentFn: (tag: string, fromFilePath: string) => ComponentInfo | undefined,
    templateStartLine?: number
): Violation[] {
    const violations: Violation[] = [];
    walkTemplate(templateContent, filePath, resolveComponentFn, violations, templateStartLine);
    return violations;
}
