// Specification/evidence integrity checks only; NOT service AC execution or independent review.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const root = new URL('../', import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const sha = (path) => createHash('sha256').update(readFileSync(new URL(path, root))).digest('hex');
const requirements = read('docs/team/host-requirements-contract.json');
const declaration = read('docs/team/host-scope-002.json');
const result = read('docs/ai-review/evidence/TEAM-SERVICE-HOST-SCOPE-002.json');
const catalog = read('docs/team/service-flow-acceptance.json');

test('HOST-SPEC-01 all 8 caller and 5 receipt fields state lost claims and degradation', () => {
  const expected = ['CC.host_id','CC.protected_source_ref','CC.logical_role','CC.runtime_generation',
    'CC.host_run_ref','CC.collected_at','CC.expires_at','CC.provenance','HR.tool_call_ref',
    'HR.response_source','HR.observed_target_ref','HR.status','HR.response_hash'];
  assert.deepEqual(requirements.field_degradation_matrix.map((r) => r.field), expected);
  for (const row of requirements.field_degradation_matrix) {
    for (const field of ['necessity','source','claim_lost_without','degradation']) assert.ok(row[field]?.length);
  }
  assert.deepEqual(requirements.minimum_platform_requests.map((r) => r.id), ['P1','P2','P3']);
  assert.equal(requirements.minimum_platform_requests[0].not_substitutable, true);
});

test('HOST-SPEC-02 local core is not 11-room service; no candidate grants send authority', () => {
  const local = requirements.products.find((p) => p.id === 'LOCAL_CORE_ONLY');
  assert.equal(local.initial_11_room_goal_satisfied, false);
  assert.equal(local.feasibility, 'PARTIAL_REDUCER_EVIDENCE_NOT_PRODUCT_VIABILITY');
  for (const product of requirements.products) {
    assert.equal(product.dispatch, false);
    assert.notEqual(product.can_open_current_send_gate, true);
  }
  const cooperative = requirements.products.find((p) => p.id === 'COOPERATIVE_11_ROLE_FLOW');
  assert.equal(cooperative.roles_count, 11);
  assert.equal(cooperative.owner_decision, 'NOT_ACCEPTED');
  assert.equal(requirements.safety.clock_relaxation_accepted, false);
});

test('HOST-SPEC-03 immutable prior negative and bounded declaration bind design result', () => {
  assert.equal(result.outcome, 'HOST_REQUIREMENTS_SPECIFIED');
  assert.ok(Object.hasOwn(declaration.terminal_outcomes, result.outcome));
  assert.equal(result.declaration.sha256, sha(result.declaration.path));
  assert.equal(result.prior_scope.sha256, sha(result.prior_scope.path));
  assert.equal(result.prior_scope.can_promote_to_available, false);
  assert.equal(result.timing.timebox_minutes, declaration.timebox_minutes);
  assert.ok(result.timing.elapsed_ms >= 0 && result.timing.elapsed_ms <= declaration.timebox_minutes * 60_000);
  assert.equal(Date.parse(result.timing.ended_at_local) - Date.parse(result.timing.started_at_local), result.timing.elapsed_ms);
  assert.ok(result.source_review.catalog_searches <= declaration.max_catalog_searches);
  for (const artifact of result.artifacts) assert.equal(artifact.sha256, sha(artifact.path));
  assert.equal(result.constraints_observed.send_calls, 0);
  assert.equal(result.constraints_observed.paid_model_calls, 0);
  assert.equal(result.gates.host_binding_available, false);
  assert.equal(result.gates.independent_review, 'NOT_PERFORMED');
});

test('HOST-SPEC-04 local admission has no host dependency but retains no-dispatch and review gates', () => {
  assert.equal(catalog.local_core_track.host_binding_dependency, false);
  assert.equal(catalog.local_core_track.dispatch, false);
  assert.equal(catalog.local_core_track.completion_is_service_completion, false);
  const phase = (id) => catalog.phase_gates.find((p) => p.id === id);
  assert.deepEqual(phase('P2').depends_on, ['LC-ADMISSION']);
  assert.deepEqual(phase('LC-ADMISSION').depends_on, []);
  assert.ok(phase('LC-ADMISSION').requires.includes('LOCAL_SCOPE_REVIEW'));
  assert.ok(phase('LC-ADMISSION').case_ids.includes('AC-24'));
  assert.deepEqual(phase('P6').depends_on, ['P5','PH-FEASIBILITY']);
  assert.deepEqual(phase('P7').depends_on, ['P0','P6']);
  assert.equal(catalog.local_core_track.bounded_bugfix.waits_for_P2b, false);
  assert.equal(catalog.local_core_track.bounded_bugfix.independent_review_required, true);
});

test('HOST-SPEC-05 host cases stay blocked and all acceptance execution remains pending', () => {
  const hostIds = requirements.local_core_track.host_case_ids;
  assert.deepEqual(catalog.local_core_track.host_case_ids, hostIds);
  assert.deepEqual(catalog.cases.filter((c) => c.host_dependency).map((c) => c.case_id), hostIds);
  for (const c of catalog.cases) {
    assert.equal(c.status, 'NOT_EXECUTED');
    assert.equal(c.local_track_disposition, hostIds.includes(c.case_id) ? 'BLOCKED_HOST' : 'LOCAL_CANDIDATE_NOT_EXECUTED');
  }
  assert.equal(catalog.cases.find((c) => c.case_id === 'AC-24').required_assertions.length, 4);
});
