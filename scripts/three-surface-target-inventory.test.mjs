import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { buildTargetInventory } from './three-surface-target-inventory.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function fixture() {
  return {
    registry: {
      schemaVersion: 1,
      sources: {
        routes: { count: 2, files: [{ route: 'a', file: 'app/a.tsx' }, { route: 'b', file: 'app/b.tsx' }] },
        prototype: { screenCount: 2, popupTargetCount: 2, hiddenScreenCount: 0, hiddenPopupTargetCount: 0 },
      },
      inventory: { screenIds: 3, routes: 2, prototypeTargets: 4 },
      surfaces: [
        { screenId: 'ING-03b', domain: 'ingredients', states: ['ready'], parity: 'aligned', prototypeTargets: ['screen:a', 'popup:shared@a', 'popup:shared@b'] },
        { screenId: 'RCP-01', domain: 'recipes', states: ['ready'], parity: 'aligned', prototypeTargets: ['screen:b', 'popup:shared@b'] },
        { screenId: 'MY-12', domain: 'my', states: ['ready'], parity: 'expoOnly', reason: 'No prototype target.' },
      ],
    },
    audit: {
      summary: { targetsMeasured: 4, activeTargets: 4, hiddenTargets: 0, activeScreens: 2, activePopupPairs: 2, activeUniquePopupIds: 1, duplicateTargets: 0, renderKindByPair: { screen: 2, overlay: 2 }, renderKindByUniquePopupId: { overlay: 1 } },
      targets: [
        { target: 'screen:a', screen: 'a', popup: null, hidden: false, render: { kind: 'screen' } },
        { target: 'screen:b', screen: 'b', popup: null, hidden: false, render: { kind: 'screen' } },
        { target: 'popup:shared@a', screen: 'a', popup: 'shared', hidden: false, render: { kind: 'overlay' } },
        { target: 'popup:shared@b', screen: 'b', popup: 'shared', hidden: false, render: { kind: 'overlay' } },
      ],
    },
  };
}
const build = ({ registry, audit }) => buildTargetInventory(registry, audit);

test('host reuse retains two target pairs, one popup ID and both ownership edges', () => {
  const input = fixture();
  const before = structuredClone(input);
  const result = build(input);
  assert.deepEqual(result.summary.prototype.total, { targets: 4, screens: 2, popupPairs: 2, uniquePopupIds: 1 });
  assert.equal(result.summary.ownershipEdges, 5);
  assert.equal(result.summary.domainTargetMemberships, 5);
  assert.equal(result.summary.crossDomainDuplicateMemberships, 1);
  assert.deepEqual(result.targets.find((row) => row.target === 'popup:shared@b').ownerScreenIds, ['ING-03b', 'RCP-01']);
  assert.deepEqual(input, before, 'pure builder must not mutate sources');
});

test('suffix ID and declared app-only states survive projection without invented state mappings', () => {
  const result = build(fixture());
  assert.equal(result.summary.app.surfaces, 3);
  assert.equal(result.summary.app.declaredStateEntries, 3);
  assert.deepEqual(result.appOnlySurfaces, [{ screenId: 'MY-12', domain: 'my', states: ['ready'], reason: 'No prototype target.' }]);
  assert.ok(result.targets.some((row) => row.ownerScreenIds.includes('ING-03b')));
  assert.equal(result.targets.some((row) => Object.hasOwn(row, 'stateMappings')), false);
});

for (const [name, mutate, pattern] of [
  ['duplicate target', ({ audit }) => audit.targets.push(structuredClone(audit.targets[0])), /audit target: duplicate/],
  ['duplicate surface', ({ registry }) => registry.surfaces.push(structuredClone(registry.surfaces[0])), /surface screenId: duplicate/],
  ['duplicate owner edge', ({ registry }) => registry.surfaces[0].prototypeTargets.push('screen:a'), /prototypeTargets: duplicate/],
  ['duplicate route', ({ registry }) => registry.sources.routes.files.push({ route: 'a', file: 'app/c.tsx' }), /route name: duplicate/],
  ['orphan target', ({ registry }) => registry.surfaces[0].prototypeTargets = ['popup:shared@a', 'popup:shared@b'], /orphan prototype target/],
  ['unknown target', ({ registry }) => registry.surfaces[0].prototypeTargets.push('screen:unknown'), /unknown prototype target/],
  ['mismatched host', ({ audit }) => audit.targets[2].screen = 'b', /target key\/host mismatch/],
  ['unknown renderer', ({ audit }) => audit.targets[2].render.kind = 'invented', /unknown renderKind/],
  ['mismatched audit total', ({ audit }) => audit.summary.targetsMeasured = 3, /audit.summary.targetsMeasured/],
  ['collapsed host-pair count', ({ audit }) => audit.summary.activePopupPairs = 1, /audit.summary.activePopupPairs/],
  ['mismatched render summary', ({ audit }) => audit.summary.renderKindByPair.overlay = 1, /renderKindByPair.overlay/],
  ['mismatched registry inventory', ({ registry }) => registry.inventory.screenIds = 2, /registry.inventory.screenIds/],
  ['mismatched route source count', ({ registry }) => registry.sources.routes.count = 1, /registry.sources.routes.count/],
  ['mismatched prototype source count', ({ registry }) => registry.sources.prototype.popupTargetCount = 1, /registry.sources.prototype.popupTargetCount/],
  ['app-only assigned target', ({ registry }) => registry.surfaces[2].prototypeTargets = ['screen:a'], /expoOnly requires no targets/],
  ['targetless non-app-only', ({ registry }) => registry.surfaces[2].parity = 'aligned', /not expoOnly/],
]) test(`rejects ${name}`, () => {
  const input = fixture();
  mutate(input);
  assert.throws(() => build(input), pattern);
});

test('hidden host and popup remain in total, outside active counts', () => {
  const input = fixture();
  input.audit.targets.filter((row) => row.screen === 'b').forEach((row) => { row.hidden = true; });
  Object.assign(input.audit.summary, { activeTargets: 2, hiddenTargets: 2, activeScreens: 1, activePopupPairs: 1, renderKindByPair: { screen: 1, overlay: 1 } });
  Object.assign(input.registry.sources.prototype, { hiddenScreenCount: 1, hiddenPopupTargetCount: 1 });
  const result = build(input);
  assert.equal(result.summary.prototype.total.targets, 4);
  assert.equal(result.summary.prototype.active.targets, 2);
  assert.equal(result.summary.prototype.hidden.targets, 2);
});

test('repository raw rows reproduce all target, route and ownership counts', () => {
  const registry = JSON.parse(readFileSync(join(root, 'apps/mobile/src/dev/surfaceRegistry.generated.json'), 'utf8'));
  const audit = JSON.parse(readFileSync(join(root, 'docs/prototypes/full-page-flow-prototype-render-audit.json'), 'utf8'));
  const result = buildTargetInventory(registry, audit);
  assert.deepEqual(result.summary.prototype.total, { targets: 185, screens: 62, popupPairs: 123, uniquePopupIds: 98 });
  assert.deepEqual(result.summary.prototype.active, { targets: 182, screens: 61, popupPairs: 121, uniquePopupIds: 96 });
  assert.equal(result.summary.prototype.hidden.targets, 3);
  assert.equal(result.summary.app.surfaces, 64);
  assert.equal(result.summary.app.routes, 53);
  assert.equal(result.summary.ownershipEdges, 202);
  assert.equal(result.summary.domainTargetMemberships, 187);
  assert.deepEqual(result.appOnlySurfaces.map((row) => row.screenId), ['MY-12', 'RCP-07']);
});

test('CLI defaults to summary and writes diagnostic provenance only to a new explicit file', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'target-inventory-'));
  const script = join(root, 'scripts/three-surface-target-inventory.mjs');
  const run = (args) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
  try {
    const initial = run([]);
    assert.equal(initial.status, 0, initial.stderr);
    assert.equal(JSON.parse(initial.stdout).prototype.total.targets, 185);
    assert.equal(JSON.parse(initial.stdout).targets, undefined);
    const output = join(temporary, 'diagnostic.json');
    const first = run([`--output=${output}`]);
    assert.equal(first.status, 0, first.stderr);
    const bytes = readFileSync(output);
    const evidence = JSON.parse(bytes);
    assert.equal(evidence.kind, 'source-projection');
    assert.match(evidence.provenance.head, /^[0-9a-f]{40}$/);
    assert.equal(evidence.provenance.inputs.length, 2);
    for (const input of evidence.provenance.inputs) assert.match(input.sha256, /^[0-9a-f]{64}$/);
    assert.notEqual(run([`--output=${output}`]).status, 0);
    assert.deepEqual(readFileSync(output), bytes);
    assert.notEqual(run(['--output=']).status, 0);
    assert.notEqual(run(['--write']).status, 0);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
