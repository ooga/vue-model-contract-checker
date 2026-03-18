/**
 * Component Registry – central database of all components (path → ComponentInfo).
 * Also resolves component tag → file path via imports.
 */

import type { ComponentInfo } from './types.js';

/** Absolute path → ComponentInfo */
const byPath = new Map<string, ComponentInfo>();

/** Normalized absolute path (for resolution) → ComponentInfo */
const pathNormalized = new Map<string, ComponentInfo>();

export function registerComponent(component: ComponentInfo): void {
    byPath.set(component.filePath, component);
    pathNormalized.set(component.filePath.replace(/\\/g, '/'), component);
}

export function getComponentByPath(filePath: string): ComponentInfo | undefined {
    const normalized = filePath.replace(/\\/g, '/');
    return byPath.get(filePath) ?? pathNormalized.get(normalized);
}

/**
 * Resolve a component tag used in a file to its ComponentInfo (and thus modelProps).
 * Uses the file's imports. Returns undefined if not a known local component.
 */
export function resolveComponent(
    tag: string,
    fromFilePath: string
): ComponentInfo | undefined {
    const fromInfo = getComponentByPath(fromFilePath);
    if (!fromInfo) return undefined;
    const resolvedPath = fromInfo.imports[tag];
    if (!resolvedPath) return undefined;
    return getComponentByPath(resolvedPath);
}

export function getAllComponents(): ComponentInfo[] {
    return Array.from(byPath.values());
}

export function clearRegistry(): void {
    byPath.clear();
    pathNormalized.clear();
}
