// Specification validation only: these tests do not execute AC-01..AC-23.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const catalog = JSON.parse(readFileSync(new URL('../docs/team/service-flow-acceptance.json', import.meta.url)));
const state = JSON.parse(readFileSync(new URL('../docs/team/service-flow-state-contract.json', import.meta.url)));
test('PLAN-01 catalog is explicitly not execution evidence', () => {
  assert.equal(catalog.kind, 'ACCEPTANCE_SPEC_NOT_EXECUTION_EVIDENCE');
  assert.equal(catalog.service_ready, false);
  assert.equal(catalog.schema_version, 3);
});
test('PLAN-02 all 23 cases have exact filenames, unique assertion IDs and evidence modes', () => {
  assert.deepEqual(catalog.cases.map((c) => c.case_id), Array.from({ length: 23 }, (_, i) => `AC-${String(i + 1).padStart(2, '0')}`));
  const assertions = [];
  for (const c of catalog.cases) {
    assert.match(c.file, /^scripts\/team-service(?:-[a-z-]+|\.live)\.test\.mjs$/);
    assert.equal(c.test_name, `${c.case_id} service contract`);
    assert.ok(c.phase.length && c.required_assertions.length);
    assert.ok(c.required_assertions.every((a) => a.requirement.trim().length > 0 && a.assertion_id.startsWith(`${c.case_id}-A`)));
    assertions.push(...c.required_assertions.map((a) => a.assertion_id));
    assert.equal(c.status, 'NOT_EXECUTED');
    assert.equal(c.evidence_mode, ['AC-16','AC-17'].includes(c.case_id) ? 'LIVE_HOST' : c.case_id === 'AC-23' ? 'LOCAL_OS_ISOLATION' : 'LOCAL_MOCK');
  }
  assert.equal(new Set(assertions).size, assertions.length);
});
test('PLAN-03 phase dependencies reference declared cases and retain separate live/approval gates', () => {
  const ids = new Set(catalog.cases.map((c) => c.case_id));
  assert.deepEqual(catalog.phase_gates.map((p) => p.id), ['P0','PH-FEASIBILITY','P2','P2b','P3','P4','P5','P6','P7','P8','PH-LIVE-PROBE','P9']);
  for (const phase of catalog.phase_gates) {
    assert.ok(phase.case_ids?.length || phase.requires?.length);
    for (const id of phase.case_ids ?? []) assert.ok(ids.has(id));
  }
  assert.ok(catalog.phase_gates.find((p) => p.id === 'P8').requires.includes('EXACT_APPROVAL_TARGET_HUMAN_DECISION'));
  assert.ok(catalog.phase_gates.find((p) => p.id === 'P7').requires.includes('TYPED_FORMAL_RECEIPT_VALIDATED'));
  catalog.phase_gates.forEach((p, i) => assert.deepEqual(p.depends_on,
    p.id === 'P2' ? ['P0','PH-FEASIBILITY'] : ['P0','PH-FEASIBILITY'].includes(p.id) ? [] : [catalog.phase_gates[i - 1].id]));
  for (const c of catalog.cases) assert.ok(catalog.phase_gates.find((p) => p.id === c.phase).case_ids.includes(c.case_id));
});

test('PLAN-07 intent generation and root-only epoch are explicit in the candidate contract', () => {
  assert.ok(state.intent_key_fields.includes('run_generation'));
  assert.equal(state.intent_reuse.new_run_generation, 'NEW_ROUTE_TOKEN');
  assert.equal(state.intent_reuse.endpoint_successor_same_generation, 'SAME_ROUTE_TOKEN');
  assert.equal(state.intent_reuse.effect_key, 'STABLE_ACROSS_RUN_GENERATIONS');
  assert.equal(state.stop_epoch_owner, 'ROOT_TASK_ONLY');
  for (const id of ['AC-08','AC-09']) assert.ok(catalog.cases.find((c) => c.case_id === id).required_assertions.some((a) => a.requirement.includes('child-issued')));
});

test('PLAN-08 live isolation and real OS ACL negative evidence remain unimplemented gates', () => {
  for (const id of ['AC-16','AC-17']) assert.equal(catalog.cases.find((c) => c.case_id === id).file, 'scripts/team-service.live.test.mjs');
  assert.equal(catalog.live_isolation.implemented, false);
  assert.equal(catalog.live_isolation.required_before, 'P4');
  assert.equal(catalog.runtime_acl.unavailable_other_principal, 'ACL_NEGATIVE_UNVERIFIED');
  assert.ok(catalog.phase_gates.find((p) => p.id === 'P4').requires.includes('AC-22_EXECUTED_PASS'));
});

test('PLAN-09 current verdict and allowed actions have one authority, not a document copy', () => {
  const plan = readFileSync(new URL('../docs/팀서비스-자동흐름-구현계획.md', import.meta.url), 'utf8');
  assert.doesNotMatch(plan, /^현재 판정:/m);
  assert.doesNotMatch(plan, /현재 allowed actions는/);
  assert.ok(plan.includes('TEAM-SERVICE-FLOW-CURRENT.json'));
  assert.equal(catalog.feasibility.owner_time_decision.alternative_status, 'OWNER_DECISION_REQUIRED');
  assert.equal(catalog.feasibility.owner_time_decision.read_only_discovery_requires_relaxation, false);
});

test('PLAN-10 every plan AC filename exactly matches catalog, including both live cases', () => {
  const plan = readFileSync(new URL('../docs/팀서비스-자동흐름-구현계획.md', import.meta.url), 'utf8');
  const mappings = [...plan.matchAll(/^\| (AC-\d+) \| (scripts\/[^ |]+) \|/gm)];
  assert.equal(mappings.length, catalog.cases.length);
  for (const [,id,file] of mappings) assert.equal(file, catalog.cases.find((c) => c.case_id === id).file, id);
});

test('PLAN-11 effect identity spans generations and queued cannot close scope', () => {
  assert.deepEqual(state.entities.effect.primary_key, ['task_id','effect_key']);
  assert.deepEqual(state.entities.effect.unique_key, ['task_id','effect_key']);
  assert.equal(state.entities.effect.run_generation_role, 'CLAIM_METADATA_NOT_IDENTITY');
  assert.equal(state.delivery_receipt_types.APP_QUEUED.close_scope, false);
  assert.ok(state.authority_schema.required.includes('issued_at'));
  assert.ok(state.root_control_schema.required.includes('command_seq'));
  assert.ok(state.control_transitions.some((t) => t.event === 'REPLAY_OR_STALE_COMMAND'));
  assert.equal(catalog.feasibility.positive_result_contract.negative_report_reuse, 'FORBIDDEN');
});

test('PLAN-04 entity schema and STOP fences include generation, authority and effect claim', () => {
  assert.deepEqual(Object.keys(state.entities).sort(), ['Task','assignment','blocker','delivery','effect','subtask']);
  for (const key of ['run_generation','decision_id','authority_revision','not_before','expires_at']) assert.ok(state.fence_required_fields.includes(key));
  assert.ok(state.concurrency.linearized.includes('STOP_CAS'));
  assert.ok(state.concurrency.linearized.includes('EFFECT_CLAIM'));
  assert.equal(state.gate_status, 'NOT_VALIDATED');
  assert.ok(catalog.phase_gates.find((p) => p.id === 'P2').case_ids.includes('AC-18'));
});

test('PLAN-05 feasibility has closed outcome set and includes trusted time', () => {
  assert.deepEqual(Object.keys(catalog.feasibility.outcomes).sort(), ['DISCOVERY_INCOMPLETE','FEASIBLE_STATIC','HOST_BINDING_UNAVAILABLE_IN_SCOPE']);
  assert.ok(catalog.feasibility.required_static.includes('trusted_utc_provenance'));
  for (const key of ['DISCOVERY_INCOMPLETE','HOST_BINDING_UNAVAILABLE_IN_SCOPE']) {
    assert.equal(catalog.feasibility.outcomes[key].implementation_allowed, false);
    assert.equal(catalog.feasibility.outcomes[key].live_allowed, false);
  }
});

test('PLAN-06 probe and pilot are separate and advisory cannot satisfy formal receipt', () => {
  assert.equal(catalog.activation.P8, 'PROBE_ONLY');
  assert.equal(catalog.activation.probe_case, 'AC-16');
  assert.equal(catalog.activation.pilot_case, 'AC-17');
  assert.ok(catalog.formal_review.candidate_required_hashes.includes('acceptance'));
  assert.ok(catalog.formal_review.reject_routes.includes('SOL_ADVISORY'));
  assert.ok(catalog.formal_review.reject_routes.includes('OPUS_DIRECT_ADVISORY'));
  assert.equal(catalog.assertion_evidence_contract.case_name_only, 'REJECTED');
  assert.equal(catalog.assertion_evidence_contract.implemented, false);
});
