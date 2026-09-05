// Specification validation only: these tests do not execute AC-01..AC-16.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const catalog = JSON.parse(readFileSync(new URL('../docs/team/service-flow-acceptance.json', import.meta.url)));
test('PLAN-01 catalog is explicitly not execution evidence', () => {
  assert.equal(catalog.kind, 'ACCEPTANCE_SPEC_NOT_EXECUTION_EVIDENCE');
  assert.equal(catalog.service_ready, false);
  assert.equal(catalog.schema_version, 1);
});
test('PLAN-02 all 16 unique cases have exact filenames, names, assertions and evidence modes', () => {
  assert.deepEqual(catalog.cases.map((c) => c.case_id), Array.from({ length: 16 }, (_, i) => `AC-${String(i + 1).padStart(2, '0')}`));
  for (const c of catalog.cases) {
    assert.match(c.file, /^scripts\/team-service-[a-z-]+\.test\.mjs$/);
    assert.equal(c.test_name, `${c.case_id} service contract`);
    assert.ok(c.phase.length && c.required_assertions.length);
    assert.ok(c.required_assertions.every((a) => typeof a === 'string' && a.trim().length > 0));
    assert.equal(c.status, 'NOT_EXECUTED');
    assert.equal(c.evidence_mode, c.case_id === 'AC-16' ? 'LIVE_HOST' : 'LOCAL_MOCK');
  }
});
test('PLAN-03 phase dependencies reference declared cases and retain separate live/approval gates', () => {
  const ids = new Set(catalog.cases.map((c) => c.case_id));
  assert.deepEqual(catalog.phase_gates.map((p) => p.id), ['P0','PH-FEASIBILITY','P2','P2b','P3','P4','P5','P6','P7','P8','PH-LIVE-PROBE','P9']);
  for (const phase of catalog.phase_gates) {
    assert.ok(phase.case_ids?.length || phase.requires?.length);
    for (const id of phase.case_ids ?? []) assert.ok(ids.has(id));
  }
  assert.ok(catalog.phase_gates.find((p) => p.id === 'P8').requires.includes('EXACT_BUNDLE_HUMAN_APPROVAL'));
  assert.ok(catalog.phase_gates.find((p) => p.id === 'P7').requires.includes('FORMAL_INDEPENDENT_GATE'));
});
