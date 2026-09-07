import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { createSchemaRegistry, readJson, validateSchema } from '../scripts/lib/core.mjs';

const root = resolve(import.meta.dirname, '..');
const cli = join(root, 'scripts', 'team-service.mjs');

function fixture() {
  const base = mkdtempSync(join(tmpdir(), 'team-service-bootstrap-'));
  const project = join(base, 'project');
  const localAppData = join(base, 'local-app-data');
  mkdirSync(project, { recursive: true });
  mkdirSync(localAppData, { recursive: true });
  return { base, project, localAppData };
}

const sha256File = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

function run(command, project, localAppData, extra = [], environment = {}) {
  const result = spawnSync(process.execPath, [cli, command, '--project', project, ...extra], {
    encoding: 'utf8', env: { ...process.env, LOCALAPPDATA: localAppData, ...environment }, windowsHide: true,
  });
  let output;
  try { output = JSON.parse(result.stdout); } catch { output = { raw: result.stdout, stderr: result.stderr }; }
  return { ...result, output };
}

test('AT-01 schema registry resolves the install receipt URN reference', () => {
  const schemas = ['project-profile', 'capability-policy', 'install-receipt', 'generated-files']
    .map((name) => readJson(join(root, 'schemas', `${name}.schema.json`)));
  const registry = createSchemaRegistry(schemas);
  const receiptSchema = schemas[2];
  const golden = readJson(join(root, 'golden', 'portable-v1-vectors.json'));
  const receipt = golden.schema_valid_receipt_vectors[0].input;
  assert.equal(receiptSchema.properties.generated_file_hashes.items.$ref,
    'urn:codex-team-service:generated-files:v1#/$defs/file');
  assert.equal(validateSchema(receipt, receiptSchema, registry), true);
  assert.throws(() => createSchemaRegistry([{
    $id: 'urn:unsupported:test', type: 'string', unsupportedKeyword: true,
  }]), { code: 'UNSUPPORTED_SCHEMA_KEYWORD' });
});

test('AT-02 init is deterministic, idempotent, and refuses overwrite', (t) => {
  const a = fixture();
  const b = fixture();
  t.after(() => { rmSync(a.base, { recursive: true, force: true }); rmSync(b.base, { recursive: true, force: true }); });
  assert.equal(run('init', a.project, a.localAppData, ['--plan']).output.status, 'READY');
  assert.equal(run('init', a.project, a.localAppData, ['--apply']).output.status, 'INIT_APPLIED');
  assert.equal(run('init', a.project, a.localAppData, ['--apply']).output.status, 'INIT_APPLIED');
  assert.equal(run('init', b.project, b.localAppData, ['--apply']).output.status, 'INIT_APPLIED');
  const aProfile = readFileSync(join(a.project, '.codex', 'team-service', 'project-profile.json'));
  const bProfile = readFileSync(join(b.project, '.codex', 'team-service', 'project-profile.json'));
  assert.deepEqual(aProfile, bProfile);
  writeFileSync(join(a.project, '.codex', 'team-service', 'README.md'), 'user edit\n');
  const refused = run('init', a.project, a.localAppData, ['--apply']);
  assert.equal(refused.status, 1);
  assert.equal(refused.output.status, 'INIT_REFUSED_CONFLICT');
  assert.equal(readFileSync(join(a.project, '.codex', 'team-service', 'README.md'), 'utf8'), 'user edit\n');
});

test('AT-04 no-send harness executes fixtures and route coverage is explicit', (t) => {
  const f = fixture();
  t.after(() => rmSync(f.base, { recursive: true, force: true }));
  const doctor = run('doctor', f.project, f.localAppData).output;
  assert.equal(doctor.actual_provider_calls, 0);
  assert.equal(doctor.sealed_tier, 'LOCAL_CORE_ONLY');
  run('init', f.project, f.localAppData, ['--apply']);
  const dry = run('dry-run', f.project, f.localAppData).output;
  assert.equal(dry.status, 'PASS_LOCAL_NO_SEND');
  assert.equal(dry.logical_roles, 11);
  assert.equal(dry.logical_required_edge_requirements, 67);
  assert.equal(dry.unique_logical_edges, 64);
  assert.deepEqual([dry.normal_dispatch_attempts, dry.negative_fake_attempts, dry.actual_provider_calls], [0, 1, 0]);
  assert.equal(dry.forbidden_call_result, 'NO_DISPATCH:fetch');
  assert.equal(dry.dynamic_import_result, 'NO_DISPATCH:dynamic-import');
  assert.equal(dry.target_internal_forbidden_call_fixture, 'REJECTED_BEFORE_EFFECT');
  assert.match(dry.no_send_harness_sha256, /^[a-f0-9]{64}$/);
});

test('AT-05 runtime receipt validates and higher-stage activation fails closed', (t) => {
  const f = fixture();
  t.after(() => rmSync(f.base, { recursive: true, force: true }));
  run('init', f.project, f.localAppData, ['--apply']);
  const runtime = run('init-runtime', f.project, f.localAppData).output;
  assert.equal(runtime.status, 'PASS_LOCAL_RUNTIME');
  assert.equal(runtime.sealed_tier, 'LOCAL_CORE_ONLY');
  assert.equal(run('verify-install', f.project, f.localAppData).output.status, 'PASS');
  const envelope = join(f.base, 'activation.json');
  writeFileSync(envelope, JSON.stringify({
    candidate_manifest_sha256: 'a'.repeat(64), review_receipt_sha256: 'b'.repeat(64),
    human_decision_sha256: 'c'.repeat(64), sealed_tier: 'LOCAL_CORE_ONLY', epoch_id: 1,
    previous_epoch: null, expected_epoch: 0, stage: 'PROBE_ONLY',
  }));
  const rejected = run('prepare-activation', f.project, f.localAppData, ['--envelope', envelope]);
  assert.equal(rejected.status, 1);
  assert.equal(rejected.output.code, 'ACTIVATION_STAGE_ABOVE_TIER');
  assert.equal(rejected.output.actual_provider_calls, 0);
});

test('AT-12 runtime loss is restore-required and never guesses endpoints', (t) => {
  const f = fixture();
  t.after(() => rmSync(f.base, { recursive: true, force: true }));
  run('init', f.project, f.localAppData, ['--apply']);
  const recovery = run('recover', f.project, f.localAppData).output;
  assert.equal(recovery.status, 'RUNTIME_RESTORE_REQUIRED');
  assert.equal(recovery.endpoint_guessing, false);
  const verify = run('verify-install', f.project, f.localAppData);
  assert.equal(verify.status, 1);
  assert.equal(verify.output.status, 'RUNTIME_RESTORE_REQUIRED');
});

test('AT-08 current-schema migration is a hash-preserving no-op', (t) => {
  const f = fixture();
  t.after(() => rmSync(f.base, { recursive: true, force: true }));
  run('init', f.project, f.localAppData, ['--apply']);
  const profilePath = join(f.project, '.codex', 'team-service', 'project-profile.json');
  const before = readFileSync(profilePath, 'utf8');
  assert.equal(run('migrate', f.project, f.localAppData, ['--plan']).output.status, 'MIGRATION_NOT_REQUIRED');
  assert.equal(run('migrate', f.project, f.localAppData, ['--apply']).output.status, 'NOOP_CURRENT_SCHEMA');
  assert.equal(readFileSync(profilePath, 'utf8'), before);
});

test('AT-08b cachebuster-only generator drift migrates with a runtime backup', (t) => {
  const f = fixture();
  t.after(() => rmSync(f.base, { recursive: true, force: true }));
  run('init', f.project, f.localAppData, ['--apply']);
  const inventoryPath = join(f.project, '.codex', 'team-service', 'generated-files.json');
  const old = JSON.parse(readFileSync(inventoryPath, 'utf8'));
  old.generator_version = '0.2.0+codex.old-cache';
  old.input_sha256 = 'a'.repeat(64);
  writeFileSync(inventoryPath, `${JSON.stringify(old, null, 2)}\n`);
  assert.equal(run('migrate', f.project, f.localAppData, ['--plan']).output.status,
    'MIGRATION_READY_CACHEBUSTER_NORMALIZATION');
  assert.equal(run('migrate', f.project, f.localAppData, ['--apply']).output.status,
    'MIGRATION_APPLIED_CACHEBUSTER_NORMALIZATION');
  assert.equal(JSON.parse(readFileSync(inventoryPath, 'utf8')).generator_version, '0.2.0');
});

test('AT-08 versioned 0.1.x to 0.2.0 migration creates declared project state files with backup', (t) => {
  const f = fixture();
  t.after(() => rmSync(f.base, { recursive: true, force: true }));
  run('init', f.project, f.localAppData, ['--apply']);
  const serviceRoot = join(f.project, '.codex', 'team-service');
  const inventoryPath = join(serviceRoot, 'generated-files.json');
  const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
  const additions = ['compatibility.json', 'acceptance.json', 'CURRENT.json', 'known-open.json'];
  inventory.generator_version = '0.1.0';
  inventory.input_sha256 = 'a'.repeat(64);
  inventory.files = inventory.files.filter((file) => !additions.some((name) => file.path.endsWith(`/${name}`)));
  writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
  for (const name of additions) rmSync(join(serviceRoot, name), { force: true });
  assert.equal(run('migrate', f.project, f.localAppData, ['--plan']).output.status, 'MIGRATION_READY_VERSIONED');
  const applied = run('migrate', f.project, f.localAppData, ['--apply']);
  assert.equal(applied.status, 0);
  assert.equal(applied.output.status, 'MIGRATION_APPLIED_VERSIONED');
  assert.match(applied.output.backup_reference, /^runtime-ref:[a-f0-9]{64}$/);
  for (const name of additions) assert(existsSync(join(serviceRoot, name)), name);
});

test('AT-03 generated role manifests contain no endpoint or provider identifier', (t) => {
  const f = fixture();
  t.after(() => rmSync(f.base, { recursive: true, force: true }));
  run('init', f.project, f.localAppData, ['--apply']);
  const chatRoot = join(f.project, '.codex', 'team-service', 'chats');
  const manifests = readdirSync(chatRoot).filter((name) => name.endsWith('.json'));
  assert.equal(manifests.length, 11);
  for (const name of manifests) {
    const manifest = JSON.parse(readFileSync(join(chatRoot, name), 'utf8'));
    assert.equal(manifest.endpoint_binding, 'RUNTIME_ONLY_NOT_PRESENT');
    assert(!JSON.stringify(manifest).match(/thread[_-]?id|provider[_-]?endpoint/i));
  }
});

test('AT-09 profile and manifests agree on 67 route-kind requirements and 64 unique routes', (t) => {
  const f = fixture();
  t.after(() => rmSync(f.base, { recursive: true, force: true }));
  run('init', f.project, f.localAppData, ['--apply']);
  const result = run('dry-run', f.project, f.localAppData);
  assert.equal(result.status, 0);
  assert.equal(result.output.coverage.status, 'PASS_PROFILE_MANIFEST');
  assert.equal(result.output.logical_required_edge_requirements, 67);
  assert.equal(result.output.unique_logical_edges, 64);
});

test('AT-06 shell probe observes a child marker and successful exit', (t) => {
  const f = fixture();
  t.after(() => rmSync(f.base, { recursive: true, force: true }));
  const result = run('doctor', f.project, f.localAppData);
  assert.equal(result.status, 0);
  assert.equal(result.output.shell.status, 'PASS');
  assert.equal(result.output.shell.exit_code, 0);
  assert.match(result.output.shell.marker_sha256, /^[a-f0-9]{64}$/);
});

test('AT-10 LOCAL_CORE can validate SIMULATION_ONLY but cannot activate it', (t) => {
  const f = fixture();
  t.after(() => rmSync(f.base, { recursive: true, force: true }));
  run('init', f.project, f.localAppData, ['--apply']);
  run('init-runtime', f.project, f.localAppData);
  const envelope = join(f.base, 'simulation.json');
  writeFileSync(envelope, JSON.stringify({
    candidate_manifest_sha256: 'a'.repeat(64), review_receipt_sha256: 'b'.repeat(64),
    human_decision_sha256: 'c'.repeat(64), sealed_tier: 'LOCAL_CORE_ONLY', epoch_id: 1,
    previous_epoch: null, expected_epoch: 0, stage: 'SIMULATION_ONLY',
  }));
  const prepared = run('prepare-activation', f.project, f.localAppData, ['--envelope', envelope]);
  assert.equal(prepared.status, 0);
  assert.equal(prepared.output.status, 'VALIDATED_NOT_ACTIVATED');
  assert.equal(prepared.output.actual_provider_calls, 0);
});

test('AT-13 Unicode project paths produce LF-only portable contracts', (t) => {
  const f = fixture();
  const unicodeProject = join(f.base, '프로젝트-é-𝕒');
  mkdirSync(unicodeProject, { recursive: true });
  t.after(() => rmSync(f.base, { recursive: true, force: true }));
  assert.equal(run('init', unicodeProject, f.localAppData, ['--apply']).output.status, 'INIT_APPLIED');
  const contractRoot = join(unicodeProject, '.codex', 'team-service');
  const files = [join(contractRoot, 'project-profile.json'), join(contractRoot, 'capability-policy.json'), join(contractRoot, 'README.md')];
  for (const path of files) assert(!readFileSync(path, 'utf8').includes('\r\n'), path);
});

test('AT-17a doctor tier hash is deterministic and project config cannot promote it', (t) => {
  const f = fixture();
  t.after(() => rmSync(f.base, { recursive: true, force: true }));
  run('init', f.project, f.localAppData, ['--apply']);
  const first = run('doctor', f.project, f.localAppData).output;
  const policy = join(f.project, '.codex', 'team-service', 'capability-policy.json');
  const edited = JSON.parse(readFileSync(policy, 'utf8'));
  edited.mode = 'PILOT';
  writeFileSync(policy, JSON.stringify(edited, null, 2));
  const second = run('doctor', f.project, f.localAppData).output;
  assert.equal(first.tier_input_sha256, second.tier_input_sha256);
  assert.equal(first.sealed_tier, 'LOCAL_CORE_ONLY');
  assert.equal(second.sealed_tier, 'LOCAL_CORE_ONLY');
});

test('AT-07 missing dependency roots fail closed and prevent runtime sealing', (t) => {
  const f = fixture();
  t.after(() => rmSync(f.base, { recursive: true, force: true }));
  run('init', f.project, f.localAppData, ['--apply']);
  const missing = Object.fromEntries([
    'codex-mission-relay', 'codex-project-orchestrator', 'codex-team-router', 'codex-account-continuity',
  ].map((name) => [name, join(f.base, 'missing', name)]));
  const environment = { CODEX_TEAM_SERVICE_DEPENDENCY_ROOTS: JSON.stringify(missing) };
  const doctor = run('doctor', f.project, f.localAppData, [], environment);
  assert.equal(doctor.status, 1);
  assert.equal(doctor.output.status, 'INCOMPATIBLE_DEPENDENCY');
  assert(doctor.output.dependencies.every((item) => item.verification_result === 'INCOMPATIBLE_DEPENDENCY'));
  const runtime = run('init-runtime', f.project, f.localAppData, [], environment);
  assert.equal(runtime.status, 1);
  assert.equal(runtime.output.status, 'INCOMPATIBLE_DEPENDENCY');
});

test('AT-17b arbitrary or negative host evidence cannot promote the sealed tier', (t) => {
  const f = fixture();
  t.after(() => rmSync(f.base, { recursive: true, force: true }));
  run('init', f.project, f.localAppData, ['--apply']);
  const evidenceRelative = 'evidence/host-scope-999.json';
  const evidencePath = join(f.project, 'evidence', 'host-scope-999.json');
  mkdirSync(join(f.project, 'evidence'), { recursive: true });
  writeFileSync(evidencePath, JSON.stringify({
    scope_id: 'HOST-SCOPE-999',
    result: 'HOST_BINDING_UNAVAILABLE_IN_SCOPE',
    caller_provenance: 'ATTESTED', receipt_provenance: 'ATTESTED',
    send_effect_fence: 'ATTESTED', trusted_utc_provenance: 'ATTESTED',
  }));
  const evidenceSha = sha256File(evidencePath);
  const unadmitted = run('doctor', f.project, f.localAppData,
    ['--host-evidence', evidencePath, '--host-evidence-sha256', evidenceSha]);
  assert.equal(unadmitted.status, 1);
  assert.equal(unadmitted.output.code, 'HOST_EVIDENCE_ADMISSION_REQUIRED');
  writeFileSync(join(f.project, '.codex', 'team-service', 'host-evidence-admission.json'), JSON.stringify({
    schema_version: 1,
    scope_id: 'HOST-SCOPE-999',
    evidence_path: evidenceRelative,
    evidence_sha256: evidenceSha,
    maximum_tier: 'AUTHENTICATED',
    decision_sha256: 'd'.repeat(64),
  }));
  const negative = run('doctor', f.project, f.localAppData,
    ['--host-evidence', evidencePath, '--host-evidence-sha256', evidenceSha]);
  assert.equal(negative.status, 1);
  assert.equal(negative.output.code, 'HOST_EVIDENCE_NEGATIVE_CANNOT_PROMOTE');
});

test('AT-05b Router tier mismatch fails both verify-install and dry-run with non-zero exit', (t) => {
  const f = fixture();
  t.after(() => rmSync(f.base, { recursive: true, force: true }));
  run('init', f.project, f.localAppData, ['--apply']);
  assert.equal(run('init-runtime', f.project, f.localAppData).status, 0);
  const routerRoot = join(f.project, '.codex', 'team-router');
  mkdirSync(routerRoot, { recursive: true });
  writeFileSync(join(routerRoot, 'policy.json'), JSON.stringify({ dispatchEnabled: true }));
  writeFileSync(join(routerRoot, 'activation-receipt.json'), JSON.stringify({ status: 'ACTIVATION_SEALED' }));
  for (const command of ['verify-install', 'dry-run']) {
    const result = run(command, f.project, f.localAppData);
    assert.equal(result.status, 1, command);
    assert.equal(result.output.status, 'TIER_POLICY_INCONSISTENT', command);
  }
});

test('AT-03 tracked project roots reject runtime-class files', (t) => {
  const f = fixture();
  t.after(() => rmSync(f.base, { recursive: true, force: true }));
  run('init', f.project, f.localAppData, ['--apply']);
  run('init-runtime', f.project, f.localAppData);
  writeFileSync(join(f.project, '.codex', 'team-service', 'outbox.json'), '{}\n');
  const result = run('verify-install', f.project, f.localAppData);
  assert.equal(result.status, 1);
  assert.equal(result.output.status, 'TRACKED_RUNTIME_LEAK');
  assert.deepEqual(result.output.runtime_leaks, ['outbox.json']);
});

test('AT-08 runtime tier reseal requires CAS and preserves prior current state', (t) => {
  const f = fixture();
  t.after(() => rmSync(f.base, { recursive: true, force: true }));
  run('init', f.project, f.localAppData, ['--apply']);
  assert.equal(run('init-runtime', f.project, f.localAppData).status, 0);
  const projectId = createHash('sha256').update(resolve(f.project).toLowerCase(), 'utf8').digest('hex').slice(0, 24);
  const runtime = join(f.localAppData, 'Codex-Team-Service', projectId);
  const currentPath = join(runtime, 'current.json');
  const current = JSON.parse(readFileSync(currentPath, 'utf8'));
  current.tier_input_sha256 = 'a'.repeat(64);
  writeFileSync(currentPath, `${JSON.stringify(current, null, 2)}\n`);
  const currentSha = sha256File(currentPath);
  const refused = run('init-runtime', f.project, f.localAppData);
  assert.equal(refused.status, 1);
  assert.equal(refused.output.status, 'RUNTIME_CAS_REQUIRED');
  const applied = run('init-runtime', f.project, f.localAppData, ['--expected-current-sha256', currentSha]);
  assert.equal(applied.status, 0);
  assert.equal(applied.output.status, 'PASS_LOCAL_RUNTIME');
  assert(existsSync(join(runtime, 'history', `current-${currentSha}.json`)));
});
