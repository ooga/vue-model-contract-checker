/**
 * vue-model-contract-checker – enforce v-model contract across Vue components.
 * Ensures props that are part of a v-model contract are only used via v-model syntax.
 */

import { program } from 'commander';
import path from 'path';
import { readFileSync, existsSync } from 'fs';
import { run } from './checker.js';
import type { CheckerConfig } from './types.js';

const DEFAULT_INCLUDE = ['**/*.vue'];
const DEFAULT_EXCLUDE = ['**/node_modules/**', '**/dist/**'];

function loadConfig(projectRoot: string, configFilePath?: string): Partial<CheckerConfig> {
    const configPath =
        configFilePath ?? path.join(projectRoot, 'vue-model-contract-checker.config.json');
    const resolved = path.isAbsolute(configPath) ? configPath : path.join(projectRoot, configPath);
    if (existsSync(resolved)) {
        try {
            const raw = readFileSync(resolved, 'utf-8');
            return JSON.parse(raw) as Partial<CheckerConfig>;
        } catch {
            // ignore invalid config
        }
    }
    return {};
}

program
    .name('vue-model-contract-checker')
    .description('Check Vue project for v-model contract violations (use v-model instead of :prop for model props)')
    .argument('[root]', 'Project root to analyze', '.')
    .option('-o, --output-json', 'Output violations as JSON')
    .option('-s, --stats', 'Print stats (components analyzed, violations count)')
    .option('-d, --debug', 'Print component graph and detected models')
    .option('--no-fail-on-error', 'Do not exit with code 1 when violations are found')
    .option('--show-unresolved', 'Show details for each unresolved import (by default only the count is shown)')
    .option('--fix', 'Auto-fix: rewrite :prop to v-model:prop (not implemented yet)')
    .option('-c, --config <path>', 'Path to config file (optional)')
    .action(async (root: string, opts: { outputJson?: boolean; stats?: boolean; debug?: boolean; failOnError?: boolean; showUnresolved?: boolean; fix?: boolean; config?: string }) => {
        const projectRoot = path.resolve(process.cwd(), root);
        const fileConfig = loadConfig(projectRoot, opts.config);
        const config: CheckerConfig = {
            include: fileConfig.include ?? DEFAULT_INCLUDE,
            exclude: fileConfig.exclude ?? DEFAULT_EXCLUDE,
            extensions: fileConfig.extensions ?? ['.vue'],
            failOnError: fileConfig.failOnError ?? true,
            projectRoot,
        };
        if (opts.fix) {
            console.warn('[vue-model-contract-checker] --fix is not implemented yet.');
        }
        await run(config, {
            outputJson: opts.outputJson,
            stats: opts.stats ?? true,
            debug: opts.debug,
            failOnError: opts.failOnError !== false,
            showUnresolved: opts.showUnresolved === true,
        });
    });

program.parse(process.argv);
