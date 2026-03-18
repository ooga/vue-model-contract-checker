/**
 * Core types for vue-model-contract-checker.
 */

export type FileEntry = {
    path: string;
};

export type ComponentInfo = {
    name: string;
    filePath: string;
    /** Local name → resolved absolute path (relative + tsconfig path aliases) */
    imports: Record<string, string>;
    /** Props that are part of v-model contract (modelValue, title, etc.) */
    modelProps: Set<string>;
    /** Raw template content for later analysis */
    templateContent: string | null;
    /** 1-based file line where template content starts (for mapping template lines to source lines) */
    templateStartLine?: number;
};

export type Violation = {
    file: string;
    line: number;
    column: number;
    component: string;
    prop: string;
    message: string;
};

export type UnresolvedImport = {
    file: string;
    line: number;
    column: number;
    specifier: string;
    message: string;
};

export type CheckerConfig = {
    include: string[];
    exclude: string[];
    extensions: string[];
    failOnError: boolean;
    projectRoot: string;
};
