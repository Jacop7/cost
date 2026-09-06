import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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

function run(command, project, localAppData, extra = []) {
  const result = spawnSync(process.execPath, [cli, command, '--project', project, ...extra], {
    encoding: 'utf8', env: { ...process.env, LOCALAPPDATA: localAppData }, windowsHide: true,
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
  assert.equal(run('init', a.project, a.localAppData, ['--apply']).output.status, 'INIT_REFUSED_CONFLICT');
  assert.equal(readFileSync(join(a.project, '.codex', 'team-service', 'README.md'), 'utf8'), 'user edit\n');
});

test('AT-03 doctor and dry-run never call a provider and expand 67 edges', (t) => {
  const f = fixture();
  t.after(() => rmSync(f.base, { recursive: true, force: true }));
  const doctor = run('doctor', f.project, f.localAppData).output;
  assert.equal(doctor.actual_provider_calls, 0);
  assert.equal(doctor.sealed_tier, 'LOCAL_CORE_ONLY');
  run('init', f.project, f.localAppData, ['--apply']);
  const dry = run('dry-run', f.project, f.localAppData).output;
  assert.equal(dry.status, 'PASS_LOCAL_NO_SEND');
  assert.equal(dry.logical_roles, 11);
  assert.equal(dry.logical_required_edges, 67);
  assert.deepEqual([dry.normal_dispatch_attempts, dry.negative_fake_attempts, dry.actual_provider_calls], [0, 1, 0]);
});

test('AT-04 runtime receipt validates and higher-stage activation fails closed', (t) => {
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

test('AT-05 runtime loss is restore-required and never guesses endpoints', (t) => {
  const f = fixture();
  t.after(() => rmSync(f.base, { recursive: true, force: true }));
  run('init', f.project, f.localAppData, ['--apply']);
  const recovery = run('recover', f.project, f.localAppData).output;
  assert.equal(recovery.status, 'RUNTIME_RESTORE_REQUIRED');
  assert.equal(recovery.endpoint_guessing, false);
  assert.equal(run('verify-install', f.project, f.localAppData).output.status, 'RUNTIME_RESTORE_REQUIRED');
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
  old.generator_version = '0.1.0+codex.old-cache';
  old.input_sha256 = 'a'.repeat(64);
  writeFileSync(inventoryPath, `${JSON.stringify(old, null, 2)}\n`);
  assert.equal(run('migrate', f.project, f.localAppData, ['--plan']).output.status,
    'MIGRATION_READY_CACHEBUSTER_NORMALIZATION');
  assert.equal(run('migrate', f.project, f.localAppData, ['--apply']).output.status,
    'MIGRATION_APPLIED_CACHEBUSTER_NORMALIZATION');
  assert.equal(JSON.parse(readFileSync(inventoryPath, 'utf8')).generator_version, '0.1.0');
});

test('AT-09 role manifests cover all 11 roles and contain no endpoint value', (t) => {
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

test('AT-17 doctor tier hash is deterministic and project config cannot promote it', (t) => {
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
