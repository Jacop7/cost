import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const contract = readJson('../docs/team/service-flow-p4-contract.json');
const catalog = readJson('../docs/team/service-flow-acceptance.json');
const current = readJson('../docs/ai-review/evidence/TEAM-SERVICE-FLOW-CURRENT.json');

test('P4-PLAN-01 entry binds completed P3 but does not waive the failed color lineage gate', () => {
  assert.equal(contract.phase, 'P4');
  assert.deepEqual(contract.depends_on, ['P3']);
  assert.equal(contract.entry.p3_required_status, 'PASS_LOCAL_ONLY_DIRECT_OPUS_RECHECK_005');
  assert.equal(contract.entry.p3_owner_decision, 'DEC-TEAM-SERVICE-P3-COMPLETION-006');
  assert.equal(contract.entry.p3_completion_run, 'AC24-P3-COMPLETION-004');
  assert.equal(contract.entry.color_lineage_waived, false);
  assert.match(current.runtime_gates.P3, /^PASS_LOCAL_ONLY/);
  assert.match(current.runtime_gates.FULL_VERIFY, /COLOR_CONTRAST_DECISION_LINEAGE/);
});

test('P4-PLAN-02 store is outside Git and preserves append-only CAS crash boundaries', () => {
  assert.match(contract.store.root, /WINDOWS_LOCALAPPDATA_KNOWN_FOLDER/);
  for (const key of [
    'git_or_onedrive_forbidden', 'project_id_single_segment_required', 'reparse_path_forbidden',
    'event_log_append_only', 'sequence_and_previous_hash_required', 'revision_cas_required',
    'atomic_publish_required', 'process_lock_required', 'live_lock_may_not_be_stolen',
    'stale_lock_requires_owner_liveness_proof',
  ]) assert.equal(contract.store[key], true, key);
  assert.equal(contract.store.corruption_action, 'QUARANTINE_AND_FAIL_CLOSED');
  assert.equal(contract.store.canonical_interpreter, 'scripts/team-service-canonical.mjs');
  assert.equal(contract.store.canonical_payload, 'NFC_SORTED_KEYS');
  assert.equal(contract.store.canonical_key_collision, 'REJECT');
  assert.equal(contract.store.non_string_identifier, 'REJECT');
  assert.equal(contract.store.dag_revision_cas_required, true);
  assert.equal(contract.store.stale_dag_rejected_before_claim_or_send, true);
  assert.equal(contract.store.dag_structure_cycle_and_limit_owner, 'P5_AC04_AC08');
});

test('P4-PLAN-03 outbox and driver forbid blind retry and any real transport', () => {
  assert.equal(contract.outbox.persist_intent_before_prepare, true);
  assert.equal(contract.outbox.persist_prepared_result_before_send, true);
  assert.equal(contract.outbox.blind_prepare_or_send_retry, false);
  assert.equal(contract.outbox.unknown_delivery, 'RECONCILE_BEFORE_ANY_RETRY');
  assert.equal(contract.outbox.exactly_once_claimed, false);
  assert.equal(contract.driver.mode, 'FOREGROUND_ONLY');
  assert.equal(contract.driver.background_service_claimed, false);
  assert.equal(contract.driver.provider_or_team_chat_available, false);
  assert.equal(contract.driver.test_transport, 'IN_PROCESS_FAKE_ONLY');
  assert.equal(contract.driver.ack_is_not_completion, true);
  assert.equal(contract.runner_relationship.p3_runner_modified_by_p4, false);
  assert.equal(contract.runner_relationship.p4_runner_owns_exact_allowlist, true);
});

test('P4-PLAN-04 ACL evidence has a standalone exact path and fails closed without another OS token', () => {
  assert.equal(contract.runtime_acl.depends_on_verify_stage3_completion, false);
  assert.equal(contract.runtime_acl.standalone_command, 'node --test scripts/team-service-runtime-acl.test.mjs');
  assert.equal(contract.runtime_acl.actual_owner_read_required, true);
  assert.equal(contract.runtime_acl.actual_other_non_admin_token_read_denial_required, true);
  assert.equal(contract.runtime_acl.missing_other_token, 'ACL_NEGATIVE_UNVERIFIED');
  assert.equal(contract.runtime_acl.missing_other_token_execution_status, 'FAIL');
  assert.equal(contract.runtime_acl.skip_may_not_satisfy_gate, true);
  assert.equal(contract.runtime_acl.account_creation_or_password_collection_allowed, false);
  assert.deepEqual(contract.runtime_acl.evidence_fields, [
    'resolved_path', 'sddl_sha256', 'checker_sha256', 'principal_type',
    'owner_read_result', 'other_principal_denial_result',
  ]);
});

test('P4-PLAN-05 completion requires exact local cases and AC24 STORE_DRIVER rerun', () => {
  assert.deepEqual(contract.acceptance.case_ids, ['AC-09', 'AC-11', 'AC-12', 'AC-23']);
  assert.equal(contract.acceptance.completion_profile, 'STORE_DRIVER');
  assert.equal(contract.acceptance.completion_requires_ac24, true);
  assert.equal(contract.acceptance.dispatch_attempts, 0);
  assert.equal(contract.acceptance.actual_provider_calls, 0);
  const gate = catalog.phase_gates.find((item) => item.id === 'P4');
  assert.deepEqual(gate.case_ids, contract.acceptance.case_ids);
  assert.equal(gate.gate_status, 'NOT_EXECUTED');
  assert.ok(gate.requires.includes('AC-22_EXECUTED_PASS'));
  assert.ok(gate.requires.includes('RUNTIME_ACL_OS_NEGATIVE_PASS'));
  assert.equal(gate.runtime_acl_evidence.standalone_command, contract.runtime_acl.standalone_command);
  assert.equal(gate.runtime_acl_evidence.depends_on_verify_stage3_completion, false);
  assert.equal(gate.runtime_acl_evidence.unavailable_other_principal, 'ACL_NEGATIVE_UNVERIFIED');
  assert.equal(gate.runtime_acl_evidence.unavailable_execution_status, 'FAIL');
  assert.equal(gate.runtime_acl_evidence.skip_satisfies_gate, false);
  const profile = catalog.cases
    .find((item) => item.case_id === 'AC-24')
    .parameterization.scenarios.STORE_DRIVER;
  assert.deepEqual(profile.planned_target_modules, contract.planned_targets);
  assert.deepEqual(profile.scenario_ids, [...contract.acceptance.case_ids]);
  assert.equal(profile.runtime_acl_evidence_source.command, contract.runtime_acl.standalone_command);
  assert.equal(profile.entry_validates_future_implementation, false);
  assert.equal(profile.completion_rerun_required, true);
});

test('P4-PLAN-06 planning cannot manufacture implementation or service authority', () => {
  assert.equal(contract.status, 'PLAN_TEST_CANDIDATE_PENDING_INDEPENDENT_REVIEW');
  assert.equal(contract.admission.implementation_may_begin_before_all_entry_gates, false);
  for (const value of Object.values(contract.scope)) assert.equal(value, false);
  assert.equal(catalog.service_ready, false);
  assert.equal(current.service_ready, false);
});
