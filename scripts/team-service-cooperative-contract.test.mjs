// Candidate specification checks only; no transport, service receipt or threat scenario is executed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const c = read('docs/team/cooperative-flow-contract.json');
const catalog = read('docs/team/service-flow-acceptance.json');

test('T2-SPEC-01 cooperative product is an unadopted candidate, not a gate bypass', () => {
  assert.equal(c.kind, 'COOPERATIVE_FLOW_CANDIDATE_NOT_EXECUTION_EVIDENCE');
  assert.equal(c.adopted, false);
  assert.equal(c.dispatch_enabled, false);
  assert.equal(c.service_ready, false);
  assert.equal(c.roles_count, 11);
  assert.equal(c.gates.current_strict_gate_bypass, false);
  assert.equal(c.gates.scope001_promoted, false);
  assert.equal(catalog.cooperative_candidate.existing_ac_16_17_reinterpreted, false);
  const declared = new Set();
  for (const gate of c.candidate_phase_gates) {
    for (const dep of gate.depends_on) assert.ok(declared.has(dep));
    assert.equal(gate.status, 'NOT_EXECUTED');
    declared.add(gate.id);
  }
  assert.ok(c.candidate_phase_gates.find((g) => g.id === 'T2-PROBE').requires.includes('FORMAL_REVIEW_AND_EXACT_PROBE_ACTIVATION'));
});

test('T2-SPEC-02 failure contracts require scope, owner and generation in addition to CAS', () => {
  assert.deepEqual(c.threats.map((t) => t.id), ['T2-01','T2-02','T2-03','T2-04','T2-05','T2-06']);
  for (const t of c.threats) assert.ok(t.checks.length > 0 && t.residual.length > 0);
  assert.ok(c.threats[0].checks.includes('NO_PAYLOAD_AUTHORITY_CHANGE'));
  assert.ok(c.threats[2].checks.includes('ASSIGNMENT_OWNER_AND_SCOPE_CHECK'));
  assert.ok(c.threats[3].checks.includes('STABLE_REQUEST_ID'));
  assert.equal(c.assumption_violation.next, 'QUARANTINE_AND_REPORT');
});

test('T2-SPEC-03 observation requires captured tool linkage and is never authentication by hash', () => {
  assert.deepEqual(c.evidence.levels, ['UNVERIFIED','OBSERVED','ATTESTED']);
  assert.equal(c.evidence.aggregate, 'MINIMUM_OF_REQUIRED_EVIDENCE');
  assert.equal(c.evidence.missing_capture_link, 'UNVERIFIED');
  assert.equal(c.evidence.content_match_alone, 'INSUFFICIENT');
  assert.equal(c.evidence.hash_is_identity_proof, false);
  assert.ok(c.evidence.observed_required.includes('ACTUAL_SEND_AND_READ_WAIT_INVOCATION_LINK'));
  assert.ok(c.evidence.attested_additional.includes('VALID_ATTESTATION_VERIFICATION'));
  assert.equal(c.evidence.capture_implemented, false);
});

test('T2-SPEC-04 observed completion is separate and must be accepted before pilot', () => {
  assert.equal(c.completion.satisfies_strict_ack_or_completed, false);
  assert.equal(c.completion.meets_initial_functional_goal_without_decision, false);
  assert.ok(c.completion.requires.includes('PRE_PILOT_EXACT_REDUCED_TRUST_DECISION'));
  assert.ok(c.completion.requires.includes('NO_BLOCKER_PENDING_UNKNOWN_DELIVERY_OR_STOP'));
  assert.equal(c.receipt.human_publication_is_human_approval, false);
  assert.equal(c.evidence.queued_is_completion, false);
  for (const f of ['assurance','required_leg_receipt_refs','quality_result_ref','human_room_publication_ref','limitations']) {
    assert.ok(c.receipt.required_fields.includes(f));
  }
});

test('T2-SPEC-05 bad evidence reopens dependent completion without resetting effects', () => {
  assert.equal(c.contamination.dependent_state, 'INVALIDATED_PENDING_RECONCILIATION');
  assert.ok(c.contamination.propagate_to.includes('HUMAN_SUMMARY'));
  assert.ok(c.contamination.propagate_to.includes('COMPLETION'));
  assert.equal(c.contamination.preserve_originals, true);
  assert.equal(c.contamination.reset_effect_to_unexecuted, false);
  assert.equal(c.contamination.blind_retry, false);
  assert.equal(c.contamination.notify_human_correction, true);
});

test('T2-SPEC-06 known verify failures do not satisfy local admission by themselves', () => {
  const gate = catalog.phase_gates.find((g) => g.id === 'LC-ADMISSION');
  assert.ok(gate.requires.includes('VERIFY_RUN_PINNED_INPUTS'));
  assert.ok(gate.requires.includes('FAILURE_DISPOSITION_INDEPENDENTLY_REVIEWED'));
  assert.equal(c.gates.known_failure_is_pass, false);
  assert.equal(c.tests.length, 8);
  for (const t of c.tests) { assert.equal(t.status, 'NOT_EXECUTED'); assert.equal(t.mock_counts_as_live, false); }
  const fix = catalog.local_core_track.bounded_bugfix.completion_contract;
  assert.deepEqual(fix.depends_on, ['LC-ADMISSION']);
  assert.deepEqual(fix.case_ids, catalog.bounded_bugfix_cases.map((x) => x.case_id));
  assert.ok(fix.required_evidence.includes('EXACT_FIX_TARGET_COMMIT'));
  assert.ok(fix.required_evidence.includes('INDEPENDENT_REVIEW_BOUND_TO_SAME_FIX_BUNDLE'));
  assert.equal(fix.gate_status, 'NOT_EXECUTED');
  for (const row of catalog.bounded_bugfix_cases) assert.ok(row.assertions.length && row.status === 'NOT_EXECUTED');
});
