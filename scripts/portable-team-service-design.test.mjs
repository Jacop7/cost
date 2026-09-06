import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { canonicalJson } from './team-service-workflow.mjs';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const contract = readJson('docs/ai-team-starter-kit/portable-package-contract.json');
const profileSchema = readJson('docs/ai-team-starter-kit/schemas/project-profile.schema.json');
const receiptSchema = readJson('docs/ai-team-starter-kit/schemas/install-receipt.schema.json');
const generatedSchema = readJson('docs/ai-team-starter-kit/schemas/generated-files.schema.json');
const profile = readJson('docs/ai-team-starter-kit/profiles/default-11-role-profile.json');
const golden = readJson('docs/ai-team-starter-kit/golden/portable-v1-vectors.json');

const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

test('PORTABLE-01 golden vectors execute the UTF-16 canonical reference', () => {
  for (const vector of golden.canonical_json_vectors) {
    const actual = canonicalJson(JSON.parse(vector.input_json_text));
    assert.equal(actual, vector.expected_utf8_text, vector.id);
    assert.equal(sha(actual), vector.expected_sha256, vector.id);
  }
  for (const vector of golden.canonical_object_vectors) {
    const actual = canonicalJson(vector.input);
    assert.equal(actual, vector.expected_utf8_text, vector.id);
    assert.equal(sha(actual), vector.expected_sha256, vector.id);
  }
  for (const vector of golden.schema_valid_receipt_vectors) {
    assert.equal(sha(canonicalJson(vector.input)), vector.expected_sha256, vector.id);
  }
});

test('PORTABLE-02 profile selectors resolve and expand to 67 required logical edges', () => {
  const roleIds = new Set(profile.roles.map((role) => role.logical_chat_id));
  assert.equal(roleIds.size, 11);
  for (const [name, ids] of Object.entries(profile.selectors)) {
    assert(ids.length > 0, name);
    for (const id of ids) assert(roleIds.has(id), `${name}:${id}`);
  }
  let expanded = 0;
  for (const requirement of profile.edge_requirements) {
    const sources = profile.selectors[requirement.source_selector];
    const targets = profile.selectors[requirement.target_selector];
    assert(sources && targets, requirement.requirement_id);
    expanded += sources.flatMap((source) => targets.map((target) => [source, target]))
      .filter(([source, target]) => !requirement.exclude_self || source !== target).length;
  }
  assert.equal(expanded, 67);
  assert(profileSchema.required.includes('expansion_semantics'));
  assert(profileSchema.additionalProperties === false);
});

test('PORTABLE-03 schema-valid receipt sample supplies every required field and resolvable file ref', () => {
  const sample = golden.schema_valid_receipt_vectors[0].input;
  for (const field of receiptSchema.required) assert(Object.hasOwn(sample, field), field);
  assert.equal(sample.dependency_observations.length, 4);
  const ref = receiptSchema.properties.generated_file_hashes.items.$ref;
  assert.equal(ref, 'urn:codex-team-service:generated-files:v1#/$defs/file');
  assert(generatedSchema.$defs.file);
  const pathPattern = new RegExp(generatedSchema.$defs.file.properties.path.pattern);
  assert(pathPattern.test('.codex/team-service/CURRENT.json'));
  for (const rejected of ['C:/secret.json', '\\\\server\\share', '../escape.json', '/rooted.json']) {
    assert(!pathPattern.test(rejected), rejected);
  }
});

test('PORTABLE-04 tier, dependency and no-send evidence contracts fail closed', () => {
  assert.equal(contract.canonical_json.key_order, 'UTF16_CODE_UNIT_LEXICOGRAPHIC_ECMASCRIPT_LT_GT');
  assert.equal(contract.tier_enforcement.configuration_may_promote_tier, false);
  assert.equal(contract.tier_enforcement.router_cross_check.mismatch, 'TIER_POLICY_INCONSISTENT');
  for (const dependency of contract.dependencies) {
    assert(dependency.consumes.length > 0, dependency.name);
    for (const item of dependency.consumes) {
      assert(item.artifact && item.schema_selector && item.verification, dependency.name);
    }
  }
  assert.deepEqual(contract.no_send_harness.required_observations, {
    normal_dispatch_attempts: 0,
    negative_fake_attempts: '>0',
    actual_provider_calls: 0,
    target_internal_forbidden_call_fixture: 'REJECTED_BEFORE_EFFECT',
  });
  const negative = golden.harness_vectors.find((item) => item.id === 'HARNESS-INTERNAL-CALL-001');
  assert.equal(negative.normal_dispatch_attempts, 0);
  assert(negative.negative_fake_attempts > 0);
  assert.equal(negative.actual_provider_calls, 0);
  assert.equal(contract.no_send_harness.error_mapping.REJECT_FORBIDDEN_GLOBAL_CALL, 'NO_DISPATCH:fetch');
  assert(contract.rebuild_inputs.includes('scripts/portable-team-service-design.test.mjs'));
});
