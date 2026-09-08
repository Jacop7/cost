import test from 'node:test';
import assert from 'node:assert/strict';
import { isSafeRepoPath, validateP3Successor } from './three-surface-p3-successor-contract.mjs';

const a = 'a'.repeat(40), b = 'b'.repeat(40), c = 'c'.repeat(40);
const state = 'ING-05/waste/web320/font-and-line2';
const finding = (id) => ({ id, ruleId: 'OVERFLOW', stateId: state, path: 'apps/mobile/src/screen.tsx', severity: 'Major' });
function fixture() {
  const observed = {
    anchorCommit: a, targetCommit: b, anchorIsAncestor: true, cleanTracked: true, cleanUntrackedProduct: true,
    files: [{ path: 'apps/mobile/src/screen.tsx', beforeBlob: a, afterBlob: b, beforeMode: '100644', afterMode: '100644' }],
    requiredStates: [state], evidence: [{ stateId: state, path: 'evidence/ING-05.png', sha256: 'd'.repeat(64), targetCommit: b }],
    historicalFindings: [finding('kept'), finding('fixed')], currentFindings: [finding('kept'), finding('added')],
    reviews: [], pendingNative: ['ios'],
  };
  const manifest = {
    anchorCommit: a, targetCommit: b, files: structuredClone(observed.files), evidence: structuredClone(observed.evidence),
    findings: { carried: [finding('kept')], new: [finding('added')], resolved: [finding('fixed')] },
    reviews: [], requestedStatus: 'CANDIDATE_ONLY',
  };
  return { manifest, observed };
}
function rejects(name, mutate, code) {
  test(name, () => {
    const f = fixture(); mutate(f);
    const result = validateP3Successor(f.manifest, f.observed);
    assert.equal(result.status, 'INVALID');
    assert.ok(result.failures.some((x) => x.code === code), JSON.stringify(result.failures));
  });
}
function approve(f) {
  const review = { id: 'review-1', targetCommit: b, readOnly: true, verdict: 'PASS' };
  f.manifest.reviews = [structuredClone(review)]; f.observed.reviews = [review];
  f.manifest.requestedStatus = 'APPROVED';
}

test('unapproved valid candidate never becomes approval', () => {
  const f = fixture(); assert.equal(validateP3Successor(f.manifest, f.observed).status, 'CANDIDATE_ONLY');
});
test('exact read-only receipt approves scope, not native final closure', () => {
  const f = fixture(); approve(f); assert.equal(validateP3Successor(f.manifest, f.observed).status, 'APPROVED');
});
test('final closure requires empty native and Finding inventories', () => {
  const f = fixture(); approve(f); f.manifest.requestedStatus = 'FINAL_CLOSED';
  f.observed.pendingNative = []; f.observed.currentFindings = [];
  f.manifest.findings = { carried: [], new: [], resolved: structuredClone(f.observed.historicalFindings) };
  assert.equal(validateP3Successor(f.manifest, f.observed).status, 'FINAL_CLOSED');
});
test('add/delete deltas allowed without inventing absent blobs', () => {
  const f = fixture(); f.manifest.files[0].beforeBlob = null; f.observed.files[0].beforeBlob = null;
  f.manifest.files[0].beforeMode = null; f.observed.files[0].beforeMode = null;
  assert.equal(validateP3Successor(f.manifest, f.observed).status, 'CANDIDATE_ONLY');
  f.manifest.files[0].beforeBlob = a; f.observed.files[0].beforeBlob = a;
  f.manifest.files[0].beforeMode = '100644'; f.observed.files[0].beforeMode = '100644';
  f.manifest.files[0].afterBlob = null; f.observed.files[0].afterBlob = null;
  f.manifest.files[0].afterMode = null; f.observed.files[0].afterMode = null;
  assert.equal(validateP3Successor(f.manifest, f.observed).status, 'CANDIDATE_ONLY');
});
for (const path of ['../x', '/x', 'C:/x', 'x\\y', 'a/../b', 'a//b', './x', '**/*.tsx', '{a,b}.tsx', 'a?b', 'a\0b', 'a%2fb', 'x:stream', 'CON/x', 'x./a'])
  test(`reject unsafe path ${JSON.stringify(path)}`, () => assert.equal(isSafeRepoPath(path), false));
test('safe unicode exact repo path', () => assert.equal(isSafeRepoPath('docs/기획안.md'), true));
for (const path of ['apps/mobile/app/[id].tsx', 'apps/mobile/app/[...slug].tsx', 'apps/mobile/app/(tabs)/index.tsx', 'apps/mobile/app/[ab].tsx'])
  test(`literal Expo route ${path}`, () => {
    const f = fixture(); f.manifest.files[0].path = path; f.observed.files[0].path = path;
    assert.equal(validateP3Successor(f.manifest, f.observed).status, 'CANDIDATE_ONLY');
  });
test('mode-only regular file change is a delta', () => {
  const f = fixture();
  for (const file of [f.manifest.files[0], f.observed.files[0]]) { file.afterBlob = a; file.afterMode = '100755'; }
  assert.equal(validateP3Successor(f.manifest, f.observed).status, 'CANDIDATE_ONLY');
});
rejects('changed target', (f) => { f.manifest.targetCommit = c; }, 'COMMIT_MISMATCH');
rejects('changed historical anchor', (f) => { f.manifest.anchorCommit = c; }, 'COMMIT_MISMATCH');
rejects('unproven ancestry', (f) => { f.observed.anchorIsAncestor = false; }, 'ANCHOR_ANCESTRY');
rejects('dirty target', (f) => { f.observed.cleanTracked = false; }, 'DIRTY_TARGET');
rejects('untracked product makes runtime dirty', (f) => { f.observed.cleanUntrackedProduct = false; }, 'UNTRACKED_PRODUCT');
rejects('untracked enumeration absent fails closed', (f) => { delete f.observed.cleanUntrackedProduct; }, 'UNTRACKED_PRODUCT');
rejects('symlink forbidden', (f) => { f.manifest.files[0].afterMode = '120000'; }, 'FILE_MODE');
rejects('submodule forbidden', (f) => { f.manifest.files[0].afterMode = '160000'; }, 'FILE_MODE');
rejects('mode mismatch', (f) => { f.manifest.files[0].afterMode = '100755'; }, 'ROW_MISMATCH');
rejects('mode without blob', (f) => { f.manifest.files[0].afterBlob = null; }, 'ABSENCE_PAIR');
rejects('missing delta', (f) => { f.manifest.files = []; }, 'MISSING');
rejects('extra delta', (f) => { f.manifest.files.push({ path: 'extra.ts', beforeBlob: null, afterBlob: c }); }, 'EXTRA');
rejects('before blob mismatch', (f) => { f.manifest.files[0].beforeBlob = c; }, 'ROW_MISMATCH');
rejects('after blob mismatch', (f) => { f.manifest.files[0].afterBlob = c; }, 'ROW_MISMATCH');
rejects('unsafe manifest path', (f) => { f.manifest.files[0].path = '../escape'; }, 'UNSAFE_PATH');
rejects('duplicate file', (f) => { f.manifest.files.push(f.manifest.files[0]); }, 'DUPLICATE');
rejects('unchanged file not delta', (f) => { f.manifest.files[0].afterBlob = a; }, 'NOT_A_DELTA');
rejects('missing evidence', (f) => { f.manifest.evidence = []; }, 'MISSING');
rejects('extra evidence state', (f) => { f.manifest.evidence.push({ ...f.manifest.evidence[0], stateId: 'extra' }); }, 'EXTRA');
rejects('duplicate state', (f) => { f.manifest.evidence.push(f.manifest.evidence[0]); }, 'DUPLICATE');
rejects('empty independent inventory', (f) => { f.observed.requiredStates = []; }, 'EMPTY_INVENTORY');
rejects('stale screenshot target', (f) => { f.manifest.evidence[0].targetCommit = a; }, 'EVIDENCE_TARGET');
rejects('screenshot bytes mismatch', (f) => { f.manifest.evidence[0].sha256 = 'e'.repeat(64); }, 'ROW_MISMATCH');
rejects('equal count different Finding', (f) => { f.manifest.findings.new = [finding('substitute')]; }, 'EXTRA');
rejects('hidden carried Finding', (f) => { f.manifest.findings.carried = []; }, 'MISSING');
rejects('fake resolved Finding', (f) => { f.manifest.findings.resolved = [finding('kept')]; }, 'EXTRA');
rejects('lost resolved identity', (f) => { f.manifest.findings.resolved = []; }, 'MISSING');
rejects('reused ID changes actual state identity', (f) => { f.observed.currentFindings[0].stateId = 'other'; }, 'FINDING_ID_REUSED');
rejects('severity change hidden in manifest', (f) => { f.manifest.findings.carried[0].severity = 'Minor'; }, 'ROW_MISMATCH');
rejects('approval without receipt', (f) => { f.manifest.requestedStatus = 'APPROVED'; }, 'APPROVAL_REQUIRED');
rejects('forged manifest-only review', (f) => { approve(f); f.observed.reviews = []; }, 'EXTRA');
rejects('review wrong SHA even if both claim it', (f) => { approve(f); f.manifest.reviews[0].targetCommit = a; f.observed.reviews[0].targetCommit = a; }, 'REVIEW_TARGET');
rejects('review is not read only', (f) => { approve(f); f.manifest.reviews[0].readOnly = false; f.observed.reviews[0].readOnly = false; }, 'REVIEW_NOT_READ_ONLY');
rejects('unresolved review blocks approval', (f) => { approve(f); f.manifest.reviews[0].verdict = 'CHANGES_REQUIRED'; f.observed.reviews[0].verdict = 'CHANGES_REQUIRED'; }, 'APPROVAL_REQUIRED');
rejects('native pending blocks final close', (f) => { approve(f); f.manifest.requestedStatus = 'FINAL_CLOSED'; }, 'NATIVE_PENDING');
rejects('open Findings block final close', (f) => { approve(f); f.manifest.requestedStatus = 'FINAL_CLOSED'; f.observed.pendingNative = []; }, 'FINDINGS_OPEN');
test('malformed inputs fail closed', () => {
  assert.equal(validateP3Successor(null, {}).status, 'INVALID');
  assert.equal(validateP3Successor({}, {}).status, 'INVALID');
});
