// Specification validation only: these tests do not execute AC-01..AC-24.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const root = new URL('../', import.meta.url);
const readJson = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const hash = (path) => createHash('sha256').update(readFileSync(
  /^[A-Za-z]:[\\/]/.test(path) ? path : new URL(path, root),
)).digest('hex');
// Static AST prerequisites only. Even executable registrations never supply runtime AC evidence.
function availability(row, source) {
  if (typeof source !== 'string') return 'NOT_IMPLEMENTED';
  const assertions = row.required_assertions ?? row.assertions;
  const ast = ts.createSourceFile('candidate.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let available = false;
  const declaredTestNames = new Set();
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'test'
      && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
      declaredTestNames.add(node.arguments[0].text);
      if (node.arguments[0].text !== row.test_name) {
        ts.forEachChild(node, visit);
        return;
      }
      const callback = node.arguments[node.arguments.length - 1];
      if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
        const markers = new Set();
        const collect = (n) => { if (ts.isStringLiteralLike(n)) markers.add(n.text); ts.forEachChild(n, collect); };
        collect(callback.body);
        if (assertions.every((a) => markers.has(a.assertion_id ?? a.id))) available = true;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!available && assertions.every((a) => [...declaredTestNames].some((name) => name.startsWith(a.assertion_id ?? a.id)))) {
    available = true;
  }
  return available ? 'AVAILABLE' : 'NOT_IMPLEMENTED';
}
function validateCase(row, source) {
  assert.equal(Object.hasOwn(row, 'status'), false, 'legacy status field');
  assert.equal(row.implementation_status, availability(row, source), `${row.case_id}: source availability drift`);
  assert.ok(['NOT_EXECUTED','PASS','FAIL','SKIPPED'].includes(row.execution_status));
  if (row.execution_status !== 'NOT_EXECUTED') {
    assert.equal(row.implementation_status, 'AVAILABLE');
    assert.ok(row.execution_evidence?.path && /^[a-f0-9]{64}$/.test(row.execution_evidence.sha256), 'actual run reference required');
    assert.equal(row.execution_evidence.sha256, hash(row.execution_evidence.path), 'case execution evidence hash drift');
  }
}
const catalog = JSON.parse(readFileSync(new URL('../docs/team/service-flow-acceptance.json', import.meta.url)));
const state = JSON.parse(readFileSync(new URL('../docs/team/service-flow-state-contract.json', import.meta.url)));
function verifyCurrentAc24Run(run, ac, currentHash = hash) {
  assert.equal(run.run_id, ac.active_run_id, 'ACTIVE_RUN_MISMATCH');
  assert.equal(run.evidence_ref, ac.execution_evidence.path, 'ACTIVE_EVIDENCE_MISMATCH');
  for (const m of run.module_sha256) assert.equal(currentHash(m.path),m.sha256,'CURRENT_MODULE_DRIFT');
  for (const [ref,key] of [['allowlist_ref','allowlist_sha256'],['runner_ref','runner_sha256'],['verifier_ref','verifier_sha256']]) {
    assert.ok(run[ref],ref); assert.equal(currentHash(run[ref]),run[key],'CURRENT_RUN_INPUT_DRIFT');
  }
  assert.equal(currentHash(run.verifier_ref),run.test_sha256,'CURRENT_TEST_DRIFT');
  assert.equal(currentHash(run.evidence_ref),run.evidence_sha256,'CURRENT_EVIDENCE_DRIFT');
}
test('PLAN-01 catalog is explicitly not execution evidence', () => {
  assert.equal(catalog.kind, 'ACCEPTANCE_SPEC_NOT_EXECUTION_EVIDENCE');
  assert.equal(catalog.service_ready, false);
  assert.equal(catalog.schema_version, 5);
});
test('PLAN-02 all 24 cases have exact filenames, unique assertion IDs and evidence modes', () => {
  assert.deepEqual(catalog.cases.map((c) => c.case_id), Array.from({ length: 24 }, (_, i) => `AC-${String(i + 1).padStart(2, '0')}`));
  const assertions = [];
  for (const c of catalog.cases) {
    assert.match(c.file, /^scripts\/team-service(?:-[a-z-]+|\.live)\.test\.mjs$/);
    assert.equal(c.test_name, `${c.case_id} service contract`);
    assert.ok(c.phase.length && c.required_assertions.length);
    assert.ok(c.required_assertions.every((a) => a.requirement.trim().length > 0 && a.assertion_id.startsWith(`${c.case_id}-A`)));
    assertions.push(...c.required_assertions.map((a) => a.assertion_id));
    const path = new URL(c.file, root);
    validateCase(c, existsSync(path) ? readFileSync(path, 'utf8') : null);
    assert.equal(c.evidence_mode, ['AC-16','AC-17'].includes(c.case_id) ? 'LIVE_HOST' : c.case_id === 'AC-23' ? 'LOCAL_OS_ISOLATION' : 'LOCAL_MOCK');
  }
  assert.equal(new Set(assertions).size, assertions.length);
  for (const c of catalog.bounded_bugfix_cases) {
    const path = new URL(c.file, root);
    validateCase(c, existsSync(path) ? readFileSync(path, 'utf8') : null);
  }
});

test('PLAN-12 availability detects absent case, partial markers and stale catalog without treating existence as PASS', () => {
  const row = { case_id:'AC-00', test_name:'AC-00 service contract', required_assertions:[{assertion_id:'AC-00-A1'}],
    implementation_status:'NOT_IMPLEMENTED', execution_status:'NOT_EXECUTED' };
  validateCase(row, null);
  validateCase(row, 'legacy unrelated test');
  validateCase(row, "test('AC-00 service contract', () => {})");
  validateCase(row, "// test('AC-00 service contract', () => { assert.ok(true, 'AC-00-A1'); })");
  validateCase(row, "const todo = \"test('AC-00 service contract', () => { 'AC-00-A1'; })\";");
  assert.throws(() => validateCase({...row,implementation_status:'AVAILABLE'}, null));
  const source = "test('AC-00 service contract', () => { assert.ok(true, 'AC-00-A1'); })";
  assert.throws(() => validateCase(row, source), /availability drift/);
  validateCase({...row,implementation_status:'AVAILABLE'}, source);
  assert.throws(() => validateCase({...row,implementation_status:'AVAILABLE',execution_status:'PASS'}, source), /actual run/);
  const evidencePath = 'scripts/team-service-plan-contract.test.mjs';
  const executed = {...row,implementation_status:'AVAILABLE',execution_status:'PASS',
    execution_evidence:{path:evidencePath,sha256:hash(evidencePath)}};
  // Synthetic validator input only; never written to the AC catalog as a service run.
  validateCase(executed, source);
  assert.throws(() => validateCase({...executed,execution_evidence:{path:evidencePath,sha256:'0'.repeat(64)}}, source), /evidence hash drift/);
  assert.throws(() => validateCase({...executed,execution_evidence:{path:'docs/ai-review/evidence/NO-SUCH-AC-RUN.json',sha256:'0'.repeat(64)}}, source), /ENOENT/);
  assert.throws(() => validateCase({...row,status:'NOT_EXECUTED'}, null), /legacy/);
});

test('PLAN-13 AC24 admits existing reducer only and requires distinct exact-bundle runs for fix and P4', () => {
  const ac = catalog.cases.find((c) => c.case_id === 'AC-24');
  const p = ac.parameterization;
  assert.equal(p.kind, 'EXACT_BUNDLE_PER_GATE');
  assert.equal(p.scenarios.ADMISSION.requires_driver_store, false);
  assert.equal(p.scenarios.ADMISSION.requires_ac22, false);
  assert.equal(p.entry_allowlist_owner, 'PLAN_TEST_ADMISSION_FIXTURE_NOT_AC22');
  for (const file of [...p.scenarios.ADMISSION.entry_modules, ...p.scenarios.ADMISSION.baseline_tests]) {
    assert.ok(existsSync(new URL(file, root)), file);
    assert.doesNotMatch(file, /driver|store|local-tests/);
  }
  for (const key of ['target_modules','import_closure','allowlist_sha256','bundle_commit','scenario_ids']) {
    assert.ok(p.required_inputs.includes(key)); assert.ok(p.run_receipt_required_fields.includes(key));
  }
  const admission = catalog.phase_gates.find((g) => g.id === 'LC-ADMISSION').ac24_run_requirement;
  const p2 = catalog.phase_gates.find((g) => g.id === 'P2').ac24_run_requirement;
  const p4 = catalog.phase_gates.find((g) => g.id === 'P4').ac24_run_requirement;
  const fix = catalog.local_core_track.bounded_bugfix.completion_contract.ac24_run_requirement;
  assert.deepEqual([admission.profile_id,fix.profile_id,p2.profile_id,p4.profile_id],
    ['ADMISSION','FIX_BUNDLE','P2_STATE_CONTRACT','STORE_DRIVER']);
  assert.deepEqual(p.scenarios.P2_STATE_CONTRACT.entry_modules, ['scripts/team-service-state-contract.test.mjs']);
  assert.deepEqual(p.scenarios.P2_STATE_CONTRACT.fixture_files, ['docs/team/service-flow-state-contract.json']);
  assert.deepEqual(p.scenarios.P2_STATE_CONTRACT.scenario_ids, ['AC-18']);
  assert.equal(p.scenarios.P2_STATE_CONTRACT.completion_only, true);
  assert.equal(p.scenarios.P2_STATE_CONTRACT.execution_status, 'PASS');
  assert.equal(p.scenarios.P2_STATE_CONTRACT.active_run_id, 'AC18-P2-STATE-CONTRACT-006');
  assert.equal(p2.status, 'PASS_LOCAL_ONLY_DIRECT_FABLE_RECHECK_006');
  assert.equal(p2.run_id, p.scenarios.P2_STATE_CONTRACT.active_run_id);
  assert.ok(p.scenarios.STORE_DRIVER.entry_modules.includes('scripts/team-service-store.mjs'));
  assert.ok(p.scenarios.STORE_DRIVER.entry_modules.includes('scripts/team-service-driver.mjs'));
  assert.match(p.receipt_reuse, /never satisfies/);
  assert.ok(Array.isArray(ac.runs));
  assert.equal(new Set(ac.runs.map((r) => r.run_id)).size, ac.runs.length);
  if(ac.execution_status==='PASS') assert.equal(ac.runs.filter(r=>r.run_id===ac.active_run_id && r.result==='PASS').length,1);
  for (const run of ac.runs) {
    for (const field of p.run_receipt_required_fields) assert.ok(Object.hasOwn(run, field), field);
    assert.ok(Object.hasOwn(p.scenarios, run.profile_id));
    assert.ok(run.target_modules.length && run.scenario_ids.length && run.import_closure.length);
    for (const key of ['allowlist_sha256','test_sha256','runner_sha256','verifier_sha256','evidence_sha256']) assert.match(run[key], /^[a-f0-9]{64}$/);
    assert.ok(['PASS','FAIL','SKIPPED','UNVERIFIED'].includes(run.result));
    if (run.result === 'PASS') {
      assert.equal(run.normal_dispatch_attempts, 0);
      if (p.scenarios[run.profile_id].negative_evidence_required) assert.ok(run.negative_fake_attempts > 0);
      else if (p.scenarios[run.profile_id].completion_only) assert.equal(run.negative_fake_attempts, 0);
      else assert.ok(run.negative_fake_attempts > 0);
      assert.equal(run.actual_provider_calls, 0);
      assert.equal(ac.implementation_status, 'AVAILABLE');
      assert.equal(run.evidence_sha256, hash(run.evidence_ref));
      // Historical PASS describes its old bytes. Only the selected current run may be consumed.
      if(run.run_id===ac.active_run_id) {
        verifyCurrentAc24Run(run,ac);
        const evidence = readJson(run.evidence_ref);
        const observed = evidence.assertion_observations ?? evidence.observation?.assertion_observations;
        assert.deepEqual(run.assertion_observations, observed, 'ASSERTION_OUTPUT_MISMATCH');
        for(const changed of [...run.module_sha256.map(m=>m.path),run.allowlist_ref,run.runner_ref,run.verifier_ref,run.evidence_ref]) {
          assert.throws(()=>verifyCurrentAc24Run(run,ac,p=>p===changed?'0'.repeat(64):hash(p)),/DRIFT/);
        }
      }
    }
  }
});

test('PLAN-14 owner decisions retain provenance, defaults and never grant send', () => {
  const current = readJson('docs/ai-review/evidence/TEAM-SERVICE-FLOW-CURRENT.json');
  assert.deepEqual(current.pending_owner_decisions.map((d) => d.id), ['D-T2-ADOPT','D-CLOCK-ALT','D-FABLE-SOFTCAP']);
  for (const d of current.pending_owner_decisions) {
    assert.ok(d.status === 'PENDING' || d.status.startsWith('SUPERSEDED_'));
    assert.ok(d.decision_owner && d.preparation_owner && d.requested_on && d.due_before);
    assert.ok(d.inputs.length && d.default_action && d.next_gate);
    assert.equal(d.grants_send, false);
  }
  assert.equal(current.implementation_authorized, false, 'a verdict label must never manufacture implementation authority');
  assert.match(current.implementation_scope, /BF-C1\/BF-C2/);
  assert.match(current.implementation_scope, /P2 state-contract\/AC-18/);
  assert.match(current.implementation_scope, /P2b local contract/);
  const p2Authorization = current.implementation_authorizations.find(
    (authorization) => authorization.decision_id === 'DEC-TEAM-SERVICE-LOCAL-ADMISSION-P2-005'
  );
  assert.ok(p2Authorization, 'P2 implementation requires an explicit scoped decision');
  assert.equal(p2Authorization.scope, 'P2_STATE_CONTRACT_ONLY');
  assert.equal(p2Authorization.implementation_authorized, true);
  assert.equal(p2Authorization.service_ready, false);
  assert.equal(p2Authorization.real_send_authorized, false);
  assert.equal(p2Authorization.decision_sha256, hash(p2Authorization.decision_path));
  assert.equal(p2Authorization.catalog_sha256, hash(p2Authorization.catalog_path));
  const catalog = readJson(p2Authorization.catalog_path);
  const p2Admission = catalog.phase_gates
    .find((gate) => gate.id === 'LC-ADMISSION')
    .scoped_admissions.find((admission) => admission.decision_id === p2Authorization.decision_id);
  assert.ok(p2Admission, 'P2 scoped admission must be registered in LC-ADMISSION');
  assert.equal(p2Admission.decision_sha256, p2Authorization.decision_sha256);
  assert.equal(p2Admission.satisfies_broader_lc_admission, false);
  assert.equal(p2Admission.satisfies_p2_dependency, true);
  assert.equal(p2Admission.real_send_authorized, false);
  assert.equal(current.service_ready, false);
  assert.equal(current.tracks.host.send_enabled, false);
  assert.equal(current.host_requirements_document.sha256, hash(current.host_requirements_document.path));
  assert.equal(current.host_scope_003.declaration.sha256, hash(current.host_scope_003.declaration.path));
  assert.equal(current.host_scope_003.status, 'EXECUTED_READ_ONLY');
  assert.equal(current.host_scope_003.outcome, 'CAPTURE_LINK_UNAVAILABLE_IN_SCOPE');
  assert.equal(current.host_scope_003.result.sha256, hash(current.host_scope_003.result.path));
  assert.equal(current.host_scope_003.correction.sha256, hash(current.host_scope_003.correction.path));
  assert.equal(current.host_scope_003.decision_basis_correction.sha256, hash(current.host_scope_003.decision_basis_correction.path));
});

test('PLAN-15 capture scope is bounded, private, fail-closed and cannot reopen strict host gates', () => {
  const scope = readJson('docs/team/host-scope-003.json');
  assert.equal(scope.scope_id, 'HOST-SCOPE-003');
  assert.equal(scope.timebox_minutes, 30);
  assert.equal(scope.max_rollout_files, 1);
  assert.deepEqual(Object.keys(scope.terminal_outcomes), ['CAPTURE_LINK_AVAILABLE_IN_SCOPE','CAPTURE_LINK_UNAVAILABLE_IN_SCOPE','DISCOVERY_INCOMPLETE']);
  for (const key of ['send','raw_transcript_export','raw_endpoint_persistence','scope001_or_002_rewrite','strict_binding_promotion','adoption_or_activation']) {
    assert.equal(scope.constraints[key], false);
  }
  assert.equal(scope.prior_scopes_immutable, true);
  assert.match(scope.precedence[0], /DISCOVERY_INCOMPLETE$/);
  assert.equal(scope.sources.find((s) => s.type === 'local_host_record').selector, 'PINNED_HISTORICAL_ROLLOUT_WITH_EXISTING_SEND_READ_WAIT_CALLS');
  const current = readJson('docs/ai-review/evidence/TEAM-SERVICE-FLOW-CURRENT.json');
  if (current.host_scope_003.status === 'DECLARED_NOT_EXECUTED') {
    for (const input of scope.baseline) assert.equal(input.sha256, hash(input.path));
  } else {
    const correction = readJson(current.host_scope_003.decision_basis_correction.path);
    assert.equal(correction.baseline_verified_at_execution, true);
    assert.equal(correction.corrected_outcome, current.host_scope_003.outcome);
  }
  const preflight = readJson(scope.sources.find((s) => s.type === 'local_host_record').preflight_record);
  assert.match(preflight.path_sha256, /^[a-f0-9]{64}$/);
  assert.match(preflight.content_sha256, /^[a-f0-9]{64}$/);
  assert.ok(preflight.bytes > 0);
  assert.equal(preflight.content_unchanged, true);
  for (const name of ['send_message_to_thread','read_thread','wait_threads']) assert.ok(preflight.counts[name].outer_result_pairs > 0);
  assert.equal(preflight.scope_analysis_started, false);
  assert.equal(preflight.send_calls_in_preflight, 0);
  assert.ok(scope.required_observations.includes('NESTED_FUNCTIONS_EXEC_BATCHING_AND_RESULT_TRUNCATION'));
});
test('PLAN-03 phase dependencies reference declared cases and retain separate live/approval gates', () => {
  const ids = new Set(catalog.cases.map((c) => c.case_id));
  assert.deepEqual(catalog.phase_gates.map((p) => p.id), ['P0','PH-FEASIBILITY','LC-ADMISSION','P2','P2b','P3','P4','P5','P6','P7','P8','PH-LIVE-PROBE','P9']);
  for (const phase of catalog.phase_gates) {
    assert.ok(phase.case_ids?.length || phase.requires?.length);
    for (const id of phase.case_ids ?? []) assert.ok(ids.has(id));
  }
  assert.ok(catalog.phase_gates.find((p) => p.id === 'P8').requires.includes('EXACT_APPROVAL_TARGET_HUMAN_DECISION'));
  assert.ok(catalog.phase_gates.find((p) => p.id === 'P7').requires.includes('TYPED_FORMAL_RECEIPT_VALIDATED'));
  const dependencies = {P0:[], 'PH-FEASIBILITY':[], 'LC-ADMISSION':[], P2:['LC-ADMISSION'],
    P2b:['P2'], P3:['P2b'], P4:['P3'], P5:['P4'], P6:['P5','PH-FEASIBILITY'],
    P7:['P0','P6'], P8:['P7'], 'PH-LIVE-PROBE':['P8'], P9:['PH-LIVE-PROBE']};
  for (const p of catalog.phase_gates) assert.deepEqual(p.depends_on, dependencies[p.id]);
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
  assert.equal(state.gate_status, 'VALIDATED_LOCAL_P2_ONLY');
  assert.ok(catalog.phase_gates.find((p) => p.id === 'P2').case_ids.includes('AC-18'));
});

test('PLAN-05 feasibility has closed outcome set and includes trusted time', () => {
  assert.deepEqual(Object.keys(catalog.feasibility.outcomes).sort(), ['DISCOVERY_INCOMPLETE','FEASIBLE_STATIC','HOST_BINDING_UNAVAILABLE_IN_SCOPE']);
  assert.ok(catalog.feasibility.required_static.includes('trusted_utc_provenance'));
  for (const key of ['DISCOVERY_INCOMPLETE','HOST_BINDING_UNAVAILABLE_IN_SCOPE']) {
    assert.equal(catalog.feasibility.outcomes[key].host_integration_allowed, false);
    assert.equal(catalog.feasibility.outcomes[key].local_core_admission, 'LC-ADMISSION');
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
