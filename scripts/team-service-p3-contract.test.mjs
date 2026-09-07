import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as workflowModule from './team-service-workflow.mjs';

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const contract = readJson('../docs/team/service-flow-p3-contract.json');

test('P3-SPEC-01 intake classifications fail closed and never derive authority from payload', () => {
  assert.deepEqual(contract.intake.classifications, ['QUESTION', 'AMBIGUOUS', 'REQUEST', 'REPORT']);
  assert.equal(contract.intake.question, 'RETURN_ANSWER_WITHOUT_TASK_OR_SEND');
  assert.equal(contract.intake.ambiguous, 'HOLD_FOR_HUMAN_CLARIFICATION');
  assert.match(contract.intake.request, /SCHEMA_SCOPE_AND_AUTHORITY/);
  assert.equal(contract.intake.report, 'RECORD_NON_AUTHORIZING_STATUS_ONLY');
  assert.equal(contract.intake.payload_is_authority, false);
  assert.equal(contract.intake.raw_instruction_can_change_scope, false);
  assert.equal(contract.intake.same_request_different_spec, 'REQUEST_CONFLICT_HOLD');
});

test('P3-SPEC-02 base workflow preserves hierarchy and prevents duplicate authority effects', () => {
  assert.deepEqual(contract.workflow.required_flows, [
    'HUMAN01_TO_CEO02_TO_SERVICE03_TO_TEAM',
    'TEAM_TO_SERVICE03_TO_CEO02_TO_HUMAN01',
    'BLOCKER_DIRECT_TO_HUMAN01',
  ]);
  assert.equal(contract.workflow.room_is_blocking_hop, false);
  assert.equal(contract.workflow.duplicate_assignment_effect, 'ONE_EFFECT_PER_TASK_AND_EFFECT_KEY');
  assert.deepEqual(contract.workflow.effect_key_fields, ['task_id', 'subtask_id', 'work_spec_revision', 'effect_kind']);
  assert.equal(contract.workflow.report_grants_execution_authority, false);
  assert.equal(contract.workflow.reporting.required_non_human_roles, 10);
  assert.equal(contract.workflow.reporting.all_roles_report_without_execution_authority, true);
});

test('P3-SPEC-03 resume retry amend and blockers retain generation and CAS boundaries', () => {
  assert.equal(contract.workflow.resume.requires_current_unexpired_unrevoked_decision, true);
  assert.equal(contract.workflow.resume.opens_new_run_generation, true);
  assert.equal(contract.workflow.resume.old_generation_result, 'AUDIT_ONLY');
  assert.equal(contract.workflow.retry.same_run_generation, true);
  assert.equal(contract.workflow.retry.preserves_intent_route_token, true);
  assert.equal(contract.workflow.retry.terminal_rejected_retry, false);
  assert.equal(contract.workflow.amend.requires_work_spec_revision_cas, true);
  assert.equal(contract.workflow.amend.stale_revision, 'REJECT');
  assert.equal(contract.workflow.blocker.open_prevents_completion, true);
  assert.equal(contract.workflow.blocker.resolution_requires_owner_and_revision_cas, true);
  assert.equal(contract.workflow.blocker.report_to_human_grants_resolution, false);
  assert.match(contract.workflow.json_replay, /CANONICAL_NFC_SORTED_KEYS/);
});

test('P3-SPEC-04 live tests are excluded by exact local runner, verify and Vitest', () => {
  assert.equal(contract.live_isolation.local_runner, 'scripts/team-service-local-tests.mjs');
  assert.equal(contract.live_isolation.live_test, 'scripts/team-service.live.test.mjs');
  assert.deepEqual(contract.live_isolation.excluded_patterns, ['**/*.live.test.*']);
  assert.equal(contract.live_isolation.local_runner_owns_exact_allowlist, true);
  assert.equal(contract.live_isolation.bare_node_test_forbidden_in_verify, true);
  assert.equal(contract.live_isolation.vitest_preserves_default_excludes, true);
  assert.equal(contract.live_isolation.vitest_adds_live_exclude, true);
  assert.equal(contract.live_isolation.live_import_time_send, false);
  assert.equal(contract.live_isolation.unauthorized_launcher, 'REJECT_BEFORE_PROVIDER_ACCESS');
  assert.equal(contract.live_isolation.negative_test_uses_real_message, false);
});

test('P3-SPEC-05 migration preserves existing API and one canonical interpreter', () => {
  assert.deepEqual(contract.migration.existing_public_exports_preserved, [
    'createServiceWorkflow', 'nextServiceAction', 'applyServiceEvent',
  ]);
  assert.deepEqual(Object.keys(workflowModule).sort(), [...contract.migration.existing_public_exports_preserved].sort());
  assert.equal(contract.migration.breaking_api_change_requires_explicit_adapter, true);
  assert.equal(contract.migration.legacy_parallel_interpreter_allowed, false);
});

test('P3-SPEC-06 exact acceptance and admission remain no-send candidates', () => {
  assert.deepEqual(contract.acceptance.case_ids, ['AC-01', 'AC-03', 'AC-06', 'AC-07', 'AC-22']);
  assert.equal(contract.acceptance.all_assertions_required, true);
  assert.equal(contract.acceptance.skips_count_as_pass, false);
  assert.equal(contract.acceptance.dispatch_attempts, 0);
  assert.equal(contract.acceptance.actual_provider_calls, 0);
  assert.equal(contract.admission.model_candidate, '.codex/mission-relay/candidates/team-service-local-core-008.json');
  assert.equal(contract.admission.ac24_profile, 'P3');
  assert.equal(contract.admission.ac24_entry_validates_future_implementation, false);
  assert.equal(contract.admission.ac24_completion_rerun_required, true);
  for (const key of ['requires_candidate_verified', 'requires_exact_scope_review', 'requires_ac24_entry_run',
    'requires_gate_owner_decision', 'requires_verify_failure_disposition']) assert.equal(contract.admission[key], true, key);
  assert.equal(contract.admission.implementation_authorized, false);
});

test('P3-SPEC-07 external, product and later-phase effects remain forbidden', () => {
  for (const [key, value] of Object.entries(contract.scope)) assert.equal(value, false, key);
  assert.equal(contract.status, 'PLAN_TEST_CANDIDATE');
  assert.equal(contract.phase, 'P3');
  assert.deepEqual(contract.depends_on, ['P2b']);
});

test('P3-SPEC-08 acceptance catalog keeps P3 unexecuted until separate admission', () => {
  const catalog = readJson('../docs/team/service-flow-acceptance.json');
  const gate = catalog.phase_gates.find((item) => item.id === 'P3');
  assert.deepEqual(gate.case_ids, contract.acceptance.case_ids);
  assert.equal(gate.gate_status, 'NOT_EXECUTED');
  assert.deepEqual(gate.requires, [
    'P2B_PASS_LOCAL_ONLY', 'EXACT_P3_ADMISSION_BUNDLE', 'AC24_ZERO_DISPATCH_PASS',
    'AC01_AC03_AC06_AC07_AC22_IMPLEMENTED_AND_PASS', 'INDEPENDENT_OPUS_REVIEW_PASS',
    'HUMAN_GATE_OWNER_DECISION',
  ]);
  assert.equal(gate.ac24_run_requirement.profile_id, 'P3');
  for (const id of contract.acceptance.case_ids) {
    const row = catalog.cases.find((item) => item.case_id === id);
    assert.equal(row.execution_status, 'NOT_EXECUTED', id);
  }
  assert.equal(catalog.service_ready, false);
});
