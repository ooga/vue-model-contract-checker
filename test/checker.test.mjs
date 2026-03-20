import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(__dirname, '..');

function runChecker(fixtureDir) {
  const args = [
    'node',
    join(projectRoot, 'dist/index.cjs'),
    join(__dirname, 'fixtures', fixtureDir),
    '--output-json',
    '--no-fail-on-error',
  ];
  try {
    const stdout = execSync(args.join(' '), {
      encoding: 'utf-8',
      cwd: projectRoot,
    });
    return JSON.parse(stdout.trim());
  } catch (err) {
    if (err.stdout) return JSON.parse(err.stdout.trim());
    throw err;
  }
}

test('good usage: v-model, no report', () => {
  const out = runChecker('good');
  assert.strictEqual(out.violations.length, 0, 'expected no violations');
});

test('bad usage: :prop instead of v-model, report with line', () => {
  const out = runChecker('bad');
  assert.strictEqual(out.violations.length, 1, 'expected one violation');
  const v = out.violations[0];
  assert.ok(v.file.endsWith('Parent.vue'));
  assert.strictEqual(v.component, 'Modal');
  assert.strictEqual(v.prop, 'visible');
  assert.strictEqual(typeof v.line, 'number');
  assert.ok(v.line >= 1);
});

test('disabled-all: disable comment, no report', () => {
  const out = runChecker('disabled-all');
  assert.strictEqual(out.violations.length, 0, 'expected no violations when disabled');
});

test('disabled-some: disable comment, some report', () => {
  const out = runChecker('disabled-some');
  assert.strictEqual(out.violations.length, 1, 'expected one violation');
  const v = out.violations[0];
  assert.ok(v.file.endsWith('Parent.vue'));
  assert.strictEqual(v.component, 'Modal');
  assert.strictEqual(v.prop, 'visible2');
  assert.strictEqual(typeof v.line, 'number');
  assert.ok(v.line >= 1);
});
