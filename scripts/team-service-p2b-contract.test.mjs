import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const contract = JSON.parse(readFileSync(new URL('../docs/team/service-flow-p2b-contract.json', import.meta.url), 'utf8'));

test('P2B-SPEC-01 intent key includes run_generation and all eight exact identity fields', () => {
  assert.deepEqual(contract.intent_identity.fields, [
    'task_id', 'run_generation', 'assignment_id', 'leg_id', 'work_spec_revision',
    'logical_source', 'logical_target', 'message_kind',
  ]);
  assert.equal(contract.intent_identity.intent_key, 'SHA256(canonical_json(identity))');
  assert.equal(contract.intent_identity.unique_constraint.length, 1);
});

test('P2B-SPEC-02 same-generation replay is stable while a new generation is distinct', () => {
  const rule = contract.get_or_prepare;
  assert.equal(rule.same_key_same_payload, 'RETURN_ORIGINAL_ROUTE_AND_TOKEN');
  assert.equal(rule.same_generation_retry, 'RETURN_ORIGINAL_ROUTE_AND_TOKEN');
  assert.equal(rule.endpoint_successor_same_generation, 'RETURN_ORIGINAL_ROUTE_AND_TOKEN');
  assert.equal(rule.new_run_generation, 'NEW_INTENT_KEY_AND_NEW_ROUTE_AND_TOKEN');
  assert.equal(contract.intent_identity.effect_key_rule, 'stable across run_generation for the same business effect');
  assert.equal(contract.intent_identity.effect_uniqueness_owner, 'docs/team/service-flow-state-contract.json#effect_uniqueness');
  assert.match(contract.intent_identity.effect_uniqueness_regression, /AC-18-A05/);
});

test('P2B-SPEC-03 conflict, concurrency and partial-success recovery fail closed', () => {
  const rule = contract.get_or_prepare;
  assert.equal(rule.same_key_different_payload, 'INTENT_CONFLICT');
  assert.equal(rule.concurrency, 'ONE_LOGICAL_PREPARE_PER_INTENT_KEY');
  assert.match(rule.partial_success_recovery, /same provider get-or-prepare/);
  assert.equal(rule.blind_prepare_retry, 'FORBIDDEN');
  assert.equal(rule.uuid_before_key_reservation, 'FORBIDDEN');
  assert.deepEqual(rule.negative_evidence_required, [
    'BLIND_PREPARE_RETRY_REJECTED', 'UUID_BEFORE_KEY_RESERVATION_REJECTED',
  ]);
  assert.equal(rule.router_cli_get_or_prepare_claim, 'NOT_IMPLEMENTED_BY_P2B_LOCAL_MOCK');
});

test('P2B-SPEC-04 one canonical interpreter is mandatory', () => {
  assert.equal(contract.canonicalization.shared_module, 'scripts/team-service-canonical.mjs');
  assert.match(contract.canonicalization.algorithm, /NFC/);
  assert.match(contract.canonicalization.migration_rule, /copied interpreters are forbidden/);
  assert.ok(contract.canonicalization.rejects.includes('NFC_KEY_COLLISION'));
  assert.ok(contract.implementation_targets.includes('scripts/team-service-workflow.mjs'));
  assert.ok(contract.implementation_targets.includes('scripts/team-service-state-contract.test.mjs'));
  assert.equal(contract.implementation_targets.length, 6);
});

test('P2B-SPEC-05 AC-10 has seven assertions and no-send evidence', () => {
  assert.equal(contract.acceptance.case_id, 'AC-10');
  assert.deepEqual(contract.acceptance.required_assertions,
    Array.from({ length: 7 }, (_, index) => `AC-10-A0${index + 1}`));
  assert.equal(contract.acceptance.no_skip, true);
  assert.equal(contract.acceptance.dispatch_attempts, 0);
  assert.equal(contract.acceptance.actual_provider_calls, 0);
});

test('P2B-SPEC-06 prework cannot self-authorize implementation or external effects', () => {
  assert.equal(contract.status, 'PLAN_TEST_CANDIDATE');
  assert.equal(contract.admission.implementation_authorized, false);
  assert.equal(contract.admission.requires_new_sealed_model_candidate, true);
  assert.equal(contract.admission.requires_exact_scope_review, true);
  assert.equal(contract.admission.requires_ac24_entry_run, true);
  assert.equal(contract.admission.requires_gate_owner_decision, true);
  for (const key of ['network_allowed', 'provider_send_allowed', 'team_router_runtime_mutation_allowed',
    'endpoint_mutation_allowed', 'app_db_supabase_mutation_allowed', 'service_ready_claim_allowed']) {
    assert.equal(contract.scope[key], false, key);
  }
});

test('P2B-SPEC-07 P4 owns durable filesystem binding', () => {
  assert.equal(contract.checkpoint.format, 'CANONICAL_JSON_SNAPSHOT');
  assert.equal(contract.checkpoint.revision_cas, true);
  assert.equal(contract.checkpoint.record_previous_hash, true);
  assert.equal(contract.checkpoint.replay_validates_hash_chain, true);
  assert.equal(contract.checkpoint.durable_filesystem_binding, 'DEFERRED_TO_P4');
});

test('P2B-SPEC-08 acceptance catalog predefines the P2b completion profile', () => {
  const catalog = JSON.parse(readFileSync(new URL('../docs/team/service-flow-acceptance.json', import.meta.url), 'utf8'));
  const gate = catalog.phase_gates.find((item) => item.id === 'P2b');
  const ac24 = catalog.cases.find((item) => item.case_id === 'AC-24');
  const profile = ac24.parameterization.scenarios.P2B;
  assert.deepEqual(gate.ac24_run_requirement, {
    case_id: 'AC-24', profile_id: 'P2B', bundle: 'EXACT_P2B_COMPLETION_BUNDLE',
    status: 'PASS_LOCAL_ONLY_DIRECT_OPUS_REVIEW_003', run_id: 'AC24-P2B-003',
  });
  assert.deepEqual(profile.entry_modules, ['scripts/team-service-intent-store.mjs']);
  assert.equal(profile.scenario, 'scripts/team-service-p2b-scenario.mjs');
  assert.deepEqual(profile.baseline_tests, ['scripts/team-service-router-adapter.test.mjs']);
  assert.deepEqual(profile.fixture_files, ['docs/team/service-flow-p2b-contract.json']);
  assert.deepEqual(profile.scenario_ids, ['AC-10']);
  assert.equal(profile.completion_only, true);
  assert.equal(profile.requires_driver_store, false);
  assert.equal(profile.requires_ac22, false);
  assert.equal(profile.execution_status, 'PASS');
  assert.equal(profile.active_run_id, 'AC24-P2B-003');
  assert.match(profile.additional_modules, /same seven AC-10 assertion IDs/);
  assert.ok(gate.requires.includes('AC24_ZERO_DISPATCH_PASS'));
  assert.ok(gate.requires.includes('INDEPENDENT_OPUS_REVIEW_PASS'));
});
