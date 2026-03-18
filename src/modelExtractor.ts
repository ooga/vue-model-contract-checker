/**
 * Extracts v-model contract props from script content.
 * Supports: defineModel(), defineModel('name'), defineEmits(['update:...']), props + emits pattern.
 */

const MODEL_VALUE = 'modelValue';

/** defineModel() → modelValue; defineModel('title') → title; defineModel<Type>('name', opts) → name */
const DEFINE_MODEL_RE =
    /defineModel\s*(?:<[^>]*>)?\s*\(\s*['"]([^'"]+)['"]\s*(?:,[^)]*)?\)|defineModel\s*(?:<[^>]*>)?\s*\(\s*\)/g;

/** defineEmits(['update:modelValue', 'update:title']) or defineEmits<...>() with update: in type */
const DEFINE_EMITS_ARRAY_RE = /defineEmits\s*\(\s*\[([^\]]*)\]\)/gs;
const UPDATE_PROP_RE = /['"]?\s*update:\s*['"]?([^'"\s,\]]+)['"]?/g;

/** props: { modelValue: ... } or props: { title: ... } - we need emits to confirm model contract */
const DEFINE_PROPS_MODEL_RE = /defineProps\s*\(\s*\{[^}]*\b(modelValue|[a-zA-Z_][a-zA-Z0-9_]*)\s*:/g;

/**
 * Extract model prop names from defineModel() calls.
 */
function extractFromDefineModel(script: string): Set<string> {
    const props = new Set<string>();
    let m: RegExpExecArray | null;
    const re = new RegExp(DEFINE_MODEL_RE.source, 'g');
    while ((m = re.exec(script)) !== null) {
        const name = m[1] !== undefined ? m[1].trim() : MODEL_VALUE;
        props.add(name);
    }
    return props;
}

/**
 * Extract model prop names from defineEmits(['update:xxx', ...]).
 */
function extractFromDefineEmits(script: string): Set<string> {
    const props = new Set<string>();
    const arrayMatch = DEFINE_EMITS_ARRAY_RE.exec(script);
    if (!arrayMatch) return props;
    const content = arrayMatch[1];
    let em: RegExpExecArray | null;
    const updateRe = new RegExp(UPDATE_PROP_RE.source, 'g');
    while ((em = updateRe.exec(content)) !== null) {
        const name = em[1].trim();
        if (name) props.add(name);
    }
    return props;
}

/**
 * Classic pattern: defineProps({ modelValue: ... }) + defineEmits(['update:modelValue']).
 * We already get update:modelValue from defineEmits. So we only need to add modelValue
 * if it appears in props and we have update:modelValue in emits. For MVP we consider
 * any prop that has a matching update: emit as model - and we get those from defineEmits.
 * So the only extra case is when script uses options API with props + emits. We could
 * scan for emit('update:modelValue') in script - that's more complex. For now
 * defineModel + defineEmits array coverage is enough.
 */
export function extractModelProps(scriptContent: string): Set<string> {
    const combined = new Set<string>();
    const fromDefineModel = extractFromDefineModel(scriptContent);
    const fromEmits = extractFromDefineEmits(scriptContent);
    for (const p of fromDefineModel) combined.add(p);
    for (const p of fromEmits) combined.add(p);
    return combined;
}
