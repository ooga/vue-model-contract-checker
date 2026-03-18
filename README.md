# vue-model-contract-checker

Statically analyze a Vue codebase to ensure **v-model contract** compliance: any component prop that is part of a v-model contract is used only via `v-model` / `v-model:prop`, and never passed as a regular prop.

Inspired by [vue-unused-components-checker](https://github.com/BerniWittmann/vue-unused-components-checker): whole-project analysis, framework-aware, simple CLI.

## Goal

- Components define a **two-way binding contract** via `defineModel()`, or `props + emits (update:*)`.
- Consumers must use `v-model` / `v-model:prop` for those props, not `:prop="value"`.

## Installation (monorepo)

From the monorepo root:

```bash
yarn install   # if the package was just added (may require lockfile update)
```

No need to install the package separately; it’s part of the workspace.

## Usage (monorepo)

From the **monorepo root**:

```bash
# Check the webapp package only (recommended)
yarn check-vmodel

# Check the whole repo (all packages with .vue files)
yarn check-vmodel:all
```

From the **checker package** (paths relative to that package):

```bash
cd packages/vue-model-contract-checker
yarn build
yarn exec node dist/index.js ../webapp        # webapp only
yarn exec node dist/index.js ../..           # whole repo
```

CLI options:

```bash
yarn check-vmodel -- --output-json           # JSON output
yarn check-vmodel -- --stats                  # component/violation counts
yarn check-vmodel -- --debug                  # print component graph
yarn check-vmodel -- --no-fail-on-error       # don’t exit 1 on violations
yarn check-vmodel -- --show-unresolved        # list each unresolved import (default: only the count)
```

## Configuration

Optional config file at project root: `vue-model-contract-checker.config.json`

```json
{
  "include": ["src/**/*.vue"],
  "exclude": ["**/node_modules/**", "**/dist/**"],
  "extensions": [".vue"],
  "failOnError": true
}
```

## Alias resolution (TypeScript paths + Vite)

Import aliases are resolved so that component paths match your project:

1. **TypeScript / JavaScript** – The checker looks for `tsconfig.json` or `jsconfig.json` in the project root. If the root has no `compilerOptions.paths`, it tries each entry in `references` until one has `paths`. Path mappings and `baseUrl` are used to resolve non-relative `.vue` imports. JSONC comments are stripped before parsing.

2. **Vite** – The checker also reads `resolve.alias` from `vite.config.ts` / `vite.config.js` (or `.mjs` / `.cjs`). It parses the config file as text and supports:
   - Object form: `alias: { '@': path.join(__dirname, 'src'), '@ds': '@dilitrust/design-system/src' }`
   - Array form: `alias: [ { find: '@', replacement: '...' } ]`
   - Replacement values: string literals, `path.resolve/join(__dirname, '...')`, `fileURLToPath(new URL('...', import.meta.url))`, and package-like strings (resolved from `node_modules`).

Resolution order: relative path → tsconfig paths → Vite alias. Non-relative `.vue` imports that cannot be resolved are reported as errors.

## Violation example

**Invalid** (prop is a v-model contract):

```vue
<MyComp :modelValue="foo" />
<MyComp :title="foo" />
```

**Valid**:

```vue
<MyComp v-model="foo" />
<MyComp v-model:title="foo" />
```

To suppress a violation for the next line, add a comment on the preceding line that contains `vue-model-contract-checker-disable-next-line` (e.g. `<!-- vue-model-contract-checker-disable-next-line -->` in templates).

## Output format

CLI:

```
[vue-model-contract-checker]

src/components/Parent.vue:12:10
❌ MyComp → prop "title" is a v-model contract
   Use "v-model:title" instead of ":title"
```

JSON (`--output-json`): object with `violations` and `unresolvedImports` arrays. Unresolved alias imports (no tsconfig path mapping) appear in `unresolvedImports`.

## Architecture

- **File Scanner** – discovers `.vue` files (include/exclude globs).
- **SFC Parser** – `@vue/compiler-sfc` to extract template and script.
- **Model extraction** – from `defineModel()`, `defineModel('name')`, `defineEmits(['update:...'])`.
- **Component Registry** – path → ComponentInfo (imports, modelProps).
- **Template Analyzer** – `@vue/compiler-dom` to parse template; for each component usage, flag `:prop` when `prop` is in modelProps.
- **Reporter** – CLI and optional JSON output.

## Scope (MVP)

- **Component resolution** via relative imports and via **TypeScript paths** (tsconfig/jsconfig `paths` + `baseUrl`).
- Unknown components (e.g. from node_modules) are ignored.

## Optional features (future)

- `--fix`: rewrite `:prop="x"` to `v-model:prop="x"` where safe.
- More emit patterns (e.g. Options API `emits: ['update:modelValue']`).

## License

MIT
