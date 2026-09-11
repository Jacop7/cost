import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { validateCandidateContract, validateManifestBytes } from './p3-review-candidate-contract.mjs';

const read = p => readFileSync(new URL(`../docs/ai-review/evidence/${p}`, import.meta.url));
const bytes = read('INGREDIENT-P3-SCOPE-MANIFEST-CANDIDATE-20260911.json');
const manifest = JSON.parse(bytes);
const decision = JSON.parse(read('P3-RANGE-EXPANSION-DECISION-V2-CANDIDATE-20260911.json'));
const changed = execFileSync('git', ['diff', '--name-only', '-z', manifest.baselineCommit, manifest.targetCommit], { cwd: new URL('..', import.meta.url), maxBuffer: 10_000_000 }).toString().split('\0').filter(Boolean);
const verify = (d = decision, m = manifest) => validateCandidateContract(d, m, changed);

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
