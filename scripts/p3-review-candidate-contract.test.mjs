import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateCandidateContract, validateManifestBytes, validateHeadCoverage, validateGateCoverage, selectedGatePaths, candidateDiffArgs } from './p3-review-candidate-contract.mjs';

const read = p => readFileSync(new URL(`../docs/ai-review/evidence/${p}`, import.meta.url));
const bytes = read('INGREDIENT-P3-SCOPE-MANIFEST-CANDIDATE-20260911.json');
const manifest = JSON.parse(bytes);
const decision = JSON.parse(read('P3-RANGE-EXPANSION-DECISION-V2-CANDIDATE-20260911.json'));
const changed = execFileSync('git', ['diff', '--name-only', '-z', manifest.baselineCommit, manifest.targetCommit], { cwd: new URL('..', import.meta.url), maxBuffer: 10_000_000 }).toString().split('\0').filter(Boolean);
const verify = (d = decision, m = manifest) => validateCandidateContract(d, m, changed);

test('coverage requires an unchanged product tree, clean index/worktree and ancestry', () => {
  const good = { changedProductPaths: [], dirtyProduct: '', targetIsAncestor: true };
  assert.deepEqual(validateHeadCoverage(good), []);
  for (const delta of [
    { changedProductPaths: ['apps/mobile/src/new.ts'] },
    { dirtyProduct: ' M apps/mobile/src/edit.ts' },
    { dirtyProduct: 'A  packages/db/supabase/migrations/new.sql' },
    { dirtyProduct: '?? apps/mobile/src/new.ts' },
    { targetIsAncestor: false },
    { dirtyProduct: undefined },
    { changedProductPaths: undefined },
  ]) assert.ok(validateHeadCoverage({ ...good, ...delta }).length > 0);
});

test('gate coverage rejects committed or dirty CI/script/config changes independently of product', () => {
  const good = { changedGatePaths: [], dirtyGatePaths: [] };
  assert.deepEqual(validateGateCoverage(good), []);
  for (const path of ['scripts/verify.mjs', '.github/workflows/verify.yml', 'package.json', 'pnpm-lock.yaml']) {
    assert.deepEqual(selectedGatePaths([path]), [path]);
    assert.ok(validateGateCoverage({ ...good, changedGatePaths: [path] }).length);
    assert.ok(validateGateCoverage({ ...good, dirtyGatePaths: [path] }).length);
  }
  assert.ok(validateGateCoverage({ ...good, dirtyGatePaths: undefined }).length);
  assert.ok(validateGateCoverage({ ...good, changedGatePaths: undefined }).length);
});

test('real Git staged and committed gate renames keep the protected source path', () => {
  // Synthetic two-file fixture, never a checkout/copy of the product repository.
  const fixture = mkdtempSync(join(tmpdir(), 'p3-gate-rename-test-'));
  const g = (...args) => execFileSync('git', args, { cwd: fixture, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    g('init'); g('config', 'user.name', 'Synthetic test'); g('config', 'user.email', 'fixture@example.invalid');
    g('config', 'commit.gpgsign', 'false');
    mkdirSync(join(fixture, 'scripts')); mkdirSync(join(fixture, 'docs'));
    mkdirSync(join(fixture, 'empty-hooks')); g('config', 'core.hooksPath', join(fixture, 'empty-hooks'));
    for (const name of ['verify.mjs', 'new-gate.mjs']) writeFileSync(join(fixture, 'scripts', name), 'export const gate = true;\n');
    g('add', '.'); g('commit', '-m', 'synthetic baseline');
    const base = g('rev-parse', 'HEAD').toString().trim();
    g('mv', 'scripts/verify.mjs', 'docs/old-gate.txt');
    g('mv', 'scripts/new-gate.mjs', 'docs/new-gate.txt');
    const gatePaths = args => selectedGatePaths(g(...args).toString().split('\0').filter(Boolean)).sort();
    assert.deepEqual(gatePaths(candidateDiffArgs('--cached')), ['scripts/new-gate.mjs', 'scripts/verify.mjs']);
    g('commit', '-m', 'synthetic rename');
    assert.deepEqual(gatePaths(candidateDiffArgs(base, 'HEAD')), ['scripts/new-gate.mjs', 'scripts/verify.mjs']);
  } finally {
    // Only the exact fresh mkdtemp fixture created above is removed.
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('absent blob cannot accidentally equal an absent target tree entry', () => {
  for (const blob of [undefined, null, '', 'not-a-blob']) {
    const m = structuredClone(manifest); m.entries[0].targetBlob = blob;
    assert.ok(verify(decision, m).some(e => e.startsWith('Invalid target blob:')));
  }
});

test('manifest requires literal safe paths, preserving Expo bracket routes', () => {
  for (const path of ['../outside.ts', '/absolute.ts', 'scripts/*.mjs', 'scripts//x.mjs']) {
    const m = structuredClone(manifest); m.entries[0].path = path;
    assert.ok(verify(decision, m).includes('Invalid literal manifest path'));
  }
  const m = structuredClone(manifest);
  m.entries[0].path = 'apps/mobile/app/(tabs)/ingredients/[id].tsx';
  assert.ok(!verify(decision, m).includes('Invalid literal manifest path'));
});

test('current candidate bytes and scope satisfy the independent contract', () => {
  assert.deepEqual(validateManifestBytes(bytes, decision.candidateScopeManifest), []);
  assert.deepEqual(verify(), []);
});
test('reordering decision batches does not change semantic ownership', () => {
  const d = structuredClone(decision); d.reviewBatches.reverse();
  assert.deepEqual(verify(d), []);
});
test('coordinated removal of an entry and gate list still fails selection rule', () => {
  const m = structuredClone(manifest); const path = 'scripts/verify.mjs';
  m.entries = m.entries.filter(e => e.path !== path);
  m.gateAndCiScopePaths = m.gateAndCiScopePaths.filter(p => p !== path);
  assert.ok(verify(decision, m).includes('Gate selection differs from independent git delta rule'));
});
test('international camelCase tests assigned to shared batch are rejected', () => {
  const m = structuredClone(manifest);
  const e = m.entries.find(e => e.path.endsWith('/internationalTaxContract.test.ts'));
  assert.ok(e); e.batch = 'B2_SHARED_KIT_AND_PLATFORM';
  assert.ok(verify(decision, m).some(e => e.startsWith('Test ownership differs:')));
});
test('gate moved to product batch is rejected', () => {
  const m = structuredClone(manifest); m.entries.find(e => e.layer === 'gate-and-ci').batch = 'B1_INGREDIENT_AND_INVENTORY';
  assert.ok(verify(decision, m).some(e => e.startsWith('Gate assigned outside B5:')));
});
test('narrowed product roots and altered precedence are rejected', () => {
  const m = structuredClone(manifest); m.productScopeRoots.pop(); m.testOwnershipRule.precedence.reverse();
  const errors = verify(decision, m);
  assert.ok(errors.includes('Product scope roots changed'));
  assert.ok(errors.includes('Test precedence changed'));
});
test('one-byte change invalidates both hash bindings', () => {
  const corrupted = Buffer.from(bytes); corrupted[0] ^= 1;
  const errors = validateManifestBytes(corrupted, decision.candidateScopeManifest);
  assert.ok(errors.includes('Manifest raw SHA mismatch'));
  assert.ok(errors.includes('Manifest blob mismatch'));
});
test('CRLF conversion and missing final newline are rejected', () => {
  for (const modified of [Buffer.from(bytes.toString().replaceAll('\n', '\r\n')), bytes.subarray(0, -1)]) {
    assert.ok(validateManifestBytes(modified, decision.candidateScopeManifest).includes('Manifest must be LF, final newline, no BOM'));
  }
});
