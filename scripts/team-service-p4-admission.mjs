// P4 PLAN_TEST only. This validates entry evidence; it never imports or implements P4 runtime code.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const expectedEvidence = [
  '.codex/mission-relay/model-plan.json',
  '.codex/mission-relay/candidates/team-service-p4-admission-009.json',
  '.codex/mission-relay/candidates/team-service-p4-admission-009.json.sha256',
  'docs/team/service-flow-p4-contract.json',
  'scripts/team-service-p4-contract.test.mjs',
  'docs/ai-review/evidence/TEAM-SERVICE-FLOW-CURRENT.json',
  'docs/team/service-flow-acceptance.json',
  'docs/ai-review/evidence/TEAM-SERVICE-P4-PLAN-OWNER-DECISION-002.json',
  'docs/ai-review/evidence/TEAM-SERVICE-P4-PLAN-OWNER-DECISION-CORRECTION-003.json',
  '.gitattributes',
  'docs/ai-review/evidence/TEAM-SERVICE-P4-PLAN-OPUS-RECHECK-002.md',
];
const expectedHarness = [
  'scripts/team-service-p4-admission.mjs',
  'scripts/team-service-p4-no-dispatch.test.mjs',
];
const forbiddenImplementation = [
  'scripts/team-service-store.mjs',
  'scripts/team-service-store.test.mjs',
  'scripts/team-service-driver.mjs',
  'scripts/team-service-driver.test.mjs',
  'scripts/team-service-runtime-acl.ps1',
  'scripts/team-service-runtime-acl.test.mjs',
  'scripts/team-service-p4-local-tests.mjs',
];

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const read = (name) => readFileSync(path.join(root, name));
const parse = (name) => JSON.parse(read(name));

export function validateP4AdmissionBundle(bundle, readSource = read) {
  assert.equal(bundle.schema_version, 1);
  assert.equal(bundle.kind, 'AC24_P4_ADMISSION_PLAN_TEST_ONLY');
  assert.equal(bundle.gate_id, 'P4');
  assert.equal(bundle.profile_id, 'STORE_DRIVER');
  assert.match(bundle.authority_commit, /^[a-f0-9]{40}$/);
  assert.equal(bundle.entry_validates_future_implementation, false);
  assert.equal(bundle.p4_implementation_authorized, false);
  assert.equal(bundle.real_send_authorized, false);
  assert.equal(bundle.service_ready, false);
  assert.deepEqual(bundle.forbidden_implementation_paths, forbiddenImplementation);
  assert.deepEqual(bundle.evidence.map((item) => item.path), expectedEvidence);
  assert.equal(new Set(bundle.evidence.map((item) => item.path)).size, bundle.evidence.length);
  for (const item of bundle.evidence) {
    assert.match(item.sha256, /^[a-f0-9]{64}$/);
    assert.equal(sha256(readSource(item.path)), item.sha256, `EVIDENCE_DRIFT:${item.path}`);
  }
  assert.deepEqual(bundle.harness.map((item) => item.path), expectedHarness);
  assert.equal(new Set(bundle.harness.map((item) => item.path)).size, bundle.harness.length);
  for (const item of bundle.harness) {
    assert.match(item.sha256, /^[a-f0-9]{64}$/);
    assert.equal(sha256(readSource(item.path)), item.sha256, `HARNESS_DRIFT:${item.path}`);
  }
  return true;
}

export function runP4Admission(bundle, readSource = read, pathExists = (name) => existsSync(path.join(root, name))) {
  validateP4AdmissionBundle(bundle, readSource);
  const canonicalPlan = JSON.parse(readSource('.codex/mission-relay/model-plan.json'));
  const candidate = JSON.parse(readSource('.codex/mission-relay/candidates/team-service-p4-admission-009.json'));
  const contract = JSON.parse(readSource('docs/team/service-flow-p4-contract.json'));
  const current = JSON.parse(readSource('docs/ai-review/evidence/TEAM-SERVICE-FLOW-CURRENT.json'));
  const acceptance = JSON.parse(readSource('docs/team/service-flow-acceptance.json'));
  const decision = JSON.parse(readSource('docs/ai-review/evidence/TEAM-SERVICE-P4-PLAN-OWNER-DECISION-002.json'));
  const correction = JSON.parse(readSource('docs/ai-review/evidence/TEAM-SERVICE-P4-PLAN-OWNER-DECISION-CORRECTION-003.json'));
  const sidecar = readSource('.codex/mission-relay/candidates/team-service-p4-admission-009.json.sha256')
    .toString('utf8').trim().split(/\s+/)[0].toLowerCase();

  assert.equal(candidate.status, 'SEALED');
  assert.equal(sidecar, sha256(readSource('.codex/mission-relay/candidates/team-service-p4-admission-009.json')));
  assert.equal(candidate.localScopeCandidate.active_path_modified, false);
  assert.equal(candidate.localScopeCandidate.predecessor_sha256, sha256(readSource('.codex/mission-relay/model-plan.json')));
  assert.equal(canonicalPlan.status, 'SEALED');
  assert.equal(contract.phase, 'P4');
  assert.equal(contract.status, 'PLAN_TEST_CANDIDATE_PENDING_INDEPENDENT_REVIEW');
  assert.equal(contract.admission.implementation_may_begin_before_all_entry_gates, false);
  assert.equal(decision.decision_id, 'DEC-TEAM-SERVICE-P4-PLAN-PREWORK-002');
  assert.equal(decision.p4_implementation_authorized, false);
  assert.equal(decision.real_send_authorized, false);
  assert.equal(correction.predecessor_decision.sha256, sha256(readSource('docs/ai-review/evidence/TEAM-SERVICE-P4-PLAN-OWNER-DECISION-002.json')));
  assert.deepEqual(correction.effective_allowed_paths, [
    '.codex/mission-relay/candidates/team-service-p4-admission-009.json',
    '.codex/mission-relay/candidates/team-service-p4-admission-009.json.sha256',
    '.gitattributes',
  ]);
  assert.equal(correction.scope_expanded_beyond_p4_admission_prework, false);
  assert.equal(correction.p4_implementation_authorized, false);
  assert.equal(current.service_ready, false);
  assert.equal(acceptance.service_ready, false);
  const gate = acceptance.phase_gates.find((item) => item.id === 'P4');
  assert.equal(gate.admission_prework.status, 'AUTHORIZED_NOT_EXECUTED');
  assert.equal(gate.admission_prework.implementation_authorized, false);
  assert.equal(gate.admission_prework.real_send_authorized, false);
  const existingImplementation = forbiddenImplementation.filter(pathExists);
  assert.deepEqual(existingImplementation, [], 'P4_IMPLEMENTATION_APPEARED_BEFORE_ADMISSION');
  const absentImplementationCount = forbiddenImplementation.length - existingImplementation.length;

  return {
    kind: 'AC24_P4_ADMISSION_OBSERVATION_NOT_GATE_APPROVAL',
    profile_id: 'STORE_DRIVER',
    authority_commit: bundle.authority_commit,
    evidence_sha256: bundle.evidence,
    candidate_sha256: sidecar,
    canonical_plan_sha256: sha256(readSource('.codex/mission-relay/model-plan.json')),
    plan_contract_status: contract.status,
    p4_gate_status: gate.gate_status,
    future_implementation_paths_checked: forbiddenImplementation.length,
    absent_future_implementation_count: absentImplementationCount,
    existing_future_implementation: existingImplementation,
    normal_dispatch_attempts: 0,
    actual_provider_calls: 0,
    dispatch_counters_basis: 'STRUCTURAL_NO_RUNTIME_MODULE_EXECUTED',
    service_ready: false,
    admission_authorized: false,
    p4_implementation_authorized: false,
    entry_validates_future_implementation: false,
    completion_rerun_required: true,
  };
}

export function verifyP4AdmissionObservation(observation, bundle) {
  assert.equal(observation.kind, 'AC24_P4_ADMISSION_OBSERVATION_NOT_GATE_APPROVAL');
  assert.equal(observation.profile_id, 'STORE_DRIVER');
  assert.equal(observation.authority_commit, bundle.authority_commit);
  assert.deepEqual(observation.evidence_sha256, bundle.evidence);
  assert.match(observation.candidate_sha256, /^[a-f0-9]{64}$/);
  assert.match(observation.canonical_plan_sha256, /^[a-f0-9]{64}$/);
  assert.equal(observation.plan_contract_status, 'PLAN_TEST_CANDIDATE_PENDING_INDEPENDENT_REVIEW');
  assert.equal(observation.p4_gate_status, 'NOT_EXECUTED');
  assert.equal(observation.future_implementation_paths_checked, forbiddenImplementation.length);
  assert.equal(observation.absent_future_implementation_count, forbiddenImplementation.length);
  assert.deepEqual(observation.existing_future_implementation, []);
  assert.equal(observation.normal_dispatch_attempts, 0);
  assert.equal(observation.actual_provider_calls, 0);
  assert.equal(observation.dispatch_counters_basis, 'STRUCTURAL_NO_RUNTIME_MODULE_EXECUTED');
  assert.equal(observation.service_ready, false);
  assert.equal(observation.admission_authorized, false);
  assert.equal(observation.p4_implementation_authorized, false);
  assert.equal(observation.entry_validates_future_implementation, false);
  assert.equal(observation.completion_rerun_required, true);
  return true;
}
