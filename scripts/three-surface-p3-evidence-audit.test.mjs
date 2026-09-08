import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { auditP3Evidence } from './three-surface-p3-evidence-audit.mjs';

const REGISTRY = 'apps/mobile/src/dev/surfaceRegistry.generated.json';
const SCRIPT = 'scripts/three-surface-vendor-failure-capture.mjs';
const PACKET = 'docs/capture/evidence.json';
const PNG = 'docs/capture/add-320-text2-failure.png';
const CONTRACT = 'docs/state-contract.json';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64');

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'p3-evidence-test-'));
  t.after(() => {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(root.includes('p3-evidence-test-'));
    rmSync(root, { recursive: true, force: true });
  });
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const put = (path, value) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), value); };
  const json = (path, value) => put(path, JSON.stringify(value, null, 2) + '\n');
  const commit = () => { git('add', '--all'); git('commit', '-qm', 'fixture'); return git('rev-parse', 'HEAD'); };
  git('init', '-q'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'user.name', 'fixture');
  git('config', 'core.autocrlf', 'false');
  git('config', 'commit.gpgsign', 'false'); git('config', 'core.hooksPath', join(root, 'no-hooks'));
  const registry = { schemaVersion: 1, surfaces: [
    { screenId: 'ING-02', states: ['ready'], prototypeTargets: ['screen:ingredient_add'], parity: 'aligned' },
    { screenId: 'ING-04', states: ['ready'], prototypeTargets: ['screen:ingredient_edit'], parity: 'aligned' },
  ] };
  json(REGISTRY, registry); put(SCRIPT, '// exact source script\n');
  const source = commit();
  const row = { key: 'add-320-text2', host: 'add', width: 320, height: 720, sourceCommit: source,
    errorShown: true, simulatedFailures: 1, retained: true,
    scaling: { factor: 2, mismatches: 0, fontFailures: [] }, shot: { file: 'add-320-text2-failure.png', sha256: sha(png) } };
  const packet = { subject: 'ingredient', phase: 'after', sourceCommit: source,
    scriptSha256: sha(readFileSync(join(root, SCRIPT))), rows: [row], blocked: [], pageErrors: [], consoleErrors: [{ message: 'HTTP 400 fixture' }] };
  json(PACKET, packet); put(PNG, png); let target = commit();
  const state = { id: 'ING-02/failure/320x720/text2/after', screenId: 'ING-02', binding: 'screen:ingredient_add',
    state: 'save-failure', host: 'add', width: 320, height: 720, pass: 'web-text-2', evidencePath: PACKET,
    rowKey: row.key, phase: 'after' };
  const contract = { schemaVersion: 1, registryBlob: git('rev-parse', `${target}:${REGISTRY}`), states: [state] };
  return { root, git, put, json, commit, registry, packet, contract, state, source,
    audit: (extra = {}) => auditP3Evidence({ root, targetCommit: git('rev-parse', 'HEAD'), sourceTargetCommit: source, evidencePaths: [PACKET], ...extra }),
    contractOn: () => { json(CONTRACT, contract); target = commit(); return target; } };
}
const invalid = r => { assert.equal(r.status, 'CANDIDATE_ONLY'); assert.equal(r.completeness, 'INVALID'); assert.ok(r.failures.length); assert.equal(r.fullP3Complete, false); };

test('no independent contract: registry denominator remains UNMAPPED and capture rows cannot complete P3', t => {
  const f = fixture(t), r = f.audit({ sourceTargetCommit: f.git('rev-parse', 'HEAD') });
  assert.equal(r.absentContract, true); assert.equal(r.completeness, 'PARTIAL');
  assert.equal(r.registry.bindingCount, 2); assert.equal(r.states.length, 0);
  assert.ok(r.bindings.every(b => b.status === 'UNMAPPED'));
  assert.equal(r.unmappedEvidence.length, 1); assert.equal(r.packets[0].status, 'STALE');
  assert.equal(r.externalReview, 'UNVERIFIED'); assert.equal(r.nativeEvidence, 'UNVERIFIED');
  assert.equal(r.packets[0].execution.consoleErrors, 1);
});
test('explicit original Git contract binds state, but old same-product capture stays STALE', t => {
  const f = fixture(t); f.contractOn(); const r = f.audit({ contractPath: CONTRACT, sourceTargetCommit: f.git('rev-parse', 'HEAD') });
  assert.equal(r.states[0].status, 'STALE'); assert.equal(r.bindings[1].status, 'UNMAPPED');
  assert.equal(r.contractAuthority, 'DECLARED_NOT_APPROVED'); assert.equal(r.fullP3Complete, false);
});
test('missing row stays MISSING, never synthesized from default ready', t => {
  const f = fixture(t); f.state.rowKey = 'missing'; f.contractOn();
  assert.equal(f.audit({ contractPath: CONTRACT }).states[0].status, 'MISSING');
});
test('separate preservation/source commits permit CURRENT without promoting old source to HEAD', t => {
  const f = fixture(t); f.contractOn(); const r = f.audit({ contractPath: CONTRACT });
  assert.notEqual(r.evidenceCommit, r.sourceTargetCommit);
  assert.equal(r.sourceTargetCommit, f.source); assert.equal(r.states[0].status, 'CURRENT');
  assert.equal(r.status, 'CANDIDATE_ONLY'); assert.equal(r.completeness, 'PARTIAL');
  assert.equal(r.fullP3Complete, false);
});
test('source comparison target must be explicitly selected', t => {
  const f = fixture(t); invalid(f.audit({ sourceTargetCommit: undefined }));
});
test('CRLF script hash is not silently accepted as original Git blob hash', t => {
  const f = fixture(t); f.packet.scriptSha256 = sha(Buffer.from('// exact source script\r\n'));
  f.json(PACKET, f.packet); f.commit(); invalid(f.audit());
});
for (const requestedStatus of ['APPROVED', 'FINAL_CLOSED', 'PASS']) test(`reject ${requestedStatus}`, t => invalid(fixture(t).audit({ requestedStatus })));
for (const [name, mutate] of [
  ['duplicate row', f => f.packet.rows.push({ ...f.packet.rows[0] })],
  ['row source substitution', f => f.packet.rows[0].sourceCommit = 'a'.repeat(40)],
  ['forged source SHA', f => f.packet.sourceCommit = 'b'.repeat(40)],
  ['script hash substitution', f => f.packet.scriptSha256 = '0'.repeat(64)],
  ['PNG hash substitution', f => f.packet.rows[0].shot.sha256 = '0'.repeat(64)],
  ['shot traversal', f => f.packet.rows[0].shot.file = '../escape.png'],
  ['unsupported vendor packet', f => f.packet.subject = 'vendor'],
  ['absent measurement fields', f => delete f.packet.rows[0].retained],
]) test(name, t => { const f = fixture(t); mutate(f); f.json(PACKET, f.packet); f.commit(); invalid(f.audit()); });
for (const [name, mutate] of [
  ['duplicate state ID', f => f.contract.states.push({ ...f.state })],
  ['unknown binding', f => f.state.binding = 'screen:not_registered'],
  ['viewport mismatch', f => f.state.height = 999],
  ['registry blob mismatch', f => f.contract.registryBlob = '0'.repeat(40)],
]) test(name, t => { const f = fixture(t); mutate(f); f.contractOn(); invalid(f.audit({ contractPath: CONTRACT })); });
test('duplicate explicit packet path rejected', t => { const f = fixture(t); invalid(f.audit({ evidencePaths: [PACKET, PACKET] })); });

for (const kind of ['exact-blob-copy', 'metadata-and-filename-copy']) test(`${kind}: path aliases cannot count one observation as two states`, t => {
  const f = fixture(t), copyPath = 'docs/capture/copy.json';
  const copied = structuredClone(f.packet);
  if (kind === 'exact-blob-copy') f.put(copyPath, readFileSync(join(f.root, PACKET)));
  else {
    copied.note = 'a differently declared measurement';
    copied.phase = 'before';
    copied.rows[0].retained = false;
    copied.rows[0].shot.file = 'renamed.png';
    f.put('docs/capture/renamed.png', png);
    // Different Git JSON blob and PNG path; the verified observation is unchanged.
    f.put(copyPath, JSON.stringify(copied));
  }
  f.contract.states.push({ ...f.state, id: 'second-state', state: 'different-declared-state',
    evidencePath: copyPath, phase: copied.phase });
  f.contractOn();
  const originalBlob = f.git('rev-parse', `HEAD:${PACKET}`), copiedBlob = f.git('rev-parse', `HEAD:${copyPath}`);
  if (kind === 'exact-blob-copy') assert.equal(originalBlob, copiedBlob);
  else assert.notEqual(originalBlob, copiedBlob);
  const result = f.audit({ contractPath: CONTRACT });
  invalid(result);
  assert.match(result.failures[0].message, /one observation reused/);
});
test('untracked self-written contract is not an observed Git source', t => {
  const f = fixture(t); f.json(CONTRACT, f.contract); invalid(f.audit({ contractPath: CONTRACT }));
});
test('dirty PNG, deleted artifact, and HEAD mismatch fail closed', t => {
  const f = fixture(t); f.put(PNG, 'changed'); invalid(f.audit());
  f.put(PNG, png); rmSync(join(f.root, PNG)); invalid(f.audit());
  f.put(PNG, png); invalid(f.audit({ targetCommit: f.source }));
});
test('script is read from historical source blob, not current replacement', t => {
  const f = fixture(t); f.put(SCRIPT, '// replacement\n'); f.commit();
  assert.equal(f.audit().failures.length, 0);
  f.packet.scriptSha256 = sha(readFileSync(join(f.root, SCRIPT))); f.json(PACKET, f.packet); f.commit(); invalid(f.audit());
});
test('valid but nonancestor source rejected', t => {
  const f = fixture(t), target = f.git('rev-parse', 'HEAD');
  f.git('checkout', '--orphan', 'unrelated'); f.git('rm', '-rf', '.');
  f.put(SCRIPT, '// unrelated\n'); const other = f.commit();
  f.git('checkout', '--detach', target); f.packet.sourceCommit = other; f.packet.rows[0].sourceCommit = other;
  f.json(PACKET, f.packet); f.commit(); invalid(f.audit());
});
test('committed symlink artifact rejected; actual symlink/junction ancestor rejected', t => {
  const f = fixture(t);
  const linkBlob = f.git('hash-object', '-w', '--stdin');
  f.git('update-index', '--cacheinfo', `120000,${linkBlob},${PNG}`); f.git('commit', '-qm', 'symlink mode fixture');
  invalid(f.audit());
  f.git('update-index', '--cacheinfo', `100644,${f.git('rev-parse', `HEAD^:${PNG}`)},${PNG}`);
  f.git('commit', '-qm', 'regular fixture mode');
  f.git('rm', '-r', 'docs/capture'); f.git('commit', '-qm', 'remove path');
  const actual = join(f.root, 'actual'); mkdirSync(actual); writeFileSync(join(actual, 'evidence.json'), JSON.stringify(f.packet));
  mkdirSync(join(f.root, 'docs'), { recursive: true });
  symlinkSync(actual, join(f.root, 'docs/capture'), 'junction'); invalid(f.audit());
});
test('repository escape and duplicate flags cannot become approval', t => {
  const f = fixture(t); invalid(f.audit({ registryPath: '../outside.json' }));
  invalid(f.audit({ evidencePaths: ['/tmp/evidence.json'] }));
});
