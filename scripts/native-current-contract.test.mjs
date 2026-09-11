import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { captureNativeScenario, evaluateNativeArtifact } from './native-touch-runtime-audit.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const contract = JSON.parse(readFileSync(resolve(root, 'scripts/native-touch-runtime-contract.json')));

test('중간 동작 실패도 이전 phase를 보존하며 뒤 시나리오를 실행한다', async () => {
  const first = await captureNativeScenario('first', '/first', async phases => {
    phases.push({ id: 'initial', rows: [], overlaps: [] });
    throw Error('required button missing');
  });
  const next = await captureNativeScenario('next', '/next', async phases => {
    phases.push({ id: 'initial', rows: [], overlaps: [] });
  });
  assert.equal(first.phases.length, 1);
  assert.equal(first.measurementFailure, 'required button missing');
  assert.equal(next.phases.length, 1);
  assert.equal(next.measurementFailure, undefined);
  const result = evaluateNativeArtifact({ platform: 'android', fontScale: 1,
    device: { density: 2 }, scenarios: [first, next] }, {
    platform: 'android', fontScale: 1, minimumTarget: 44, expectedSourceLineage: 0,
    scenarios: [{ id: 'first', targets: [] }, { id: 'next', targets: [] }],
  });
  assert.ok(result.failures.some(f => f.includes('required button missing')));
});

test('초기 화면 수집 실패도 빈 phase와 실패 원인을 남긴다', async () => {
  const result = await captureNativeScenario('broken', '/broken', () => { throw Error('not mounted'); });
  assert.deepEqual(result.phases, []);
  assert.equal(result.measurementFailure, 'not mounted');
});

test('현재 13시나리오는 4개 플랫폼/배율과44dp·확대 증거 조건을 유지한다', () => {
  assert.equal(contract.minimumTarget, 44);
  assert.deepEqual(contract.closedPlatforms, ['android', 'ios']);
  assert.deepEqual(contract.evidenceMatrix.map(x => `${x.platform}@${x.evidenceScale}`), ['android@1', 'android@2', 'ios@1', 'ios@2']);
  assert.deepEqual(contract.requireScaledLayoutWitness, ['ios']);
  assert.equal(contract.scaledLayoutWitness.minimumDimensionChangedRatio, 0.3);
  assert.equal(contract.scenarios.length, 13);
  assert.equal(new Set(contract.scenarios.map(s => s.id)).size, 13);
  assert.equal(contract.diagnosticScope, undefined);
});
test('기본 화면·독립 재고 필터·부자재 수정·손익 적용 타깃은 필수로 남는다', () => {
  const ids = contract.scenarios.map(s => s.id);
  for (const id of ['ingredient-list', 'recipe-list', 'discard-history-redirect', 'stock-period', 'stock-kind', 'stock-order', 'vendors', 'orders', 'recipe-categories', 'recipe-materials', 'recipe-add', 'sales-home', 'recipe-profit-preview']) assert.ok(ids.includes(id));
  const targets = contract.scenarios.flatMap(s => s.targets);
  assert.equal(targets.find(t => t.id === 'recommended-price-apply').minimumObserved, 1);
  for (const id of ['material-quantity-edit', 'material-sheet-close', 'material-sheet-delete', 'material-sheet-save']) assert.ok(targets.some(t => t.id === id));
  assert.equal(targets.reduce((n, t) => n + t.sourceEntries.length, 0), contract.expectedSourceLineage);
  assert.equal(contract.expectedSourceLineage, 30);
});
test('모든 타깃은 실제 존재하는 소스 줄과 측정 phase를 참조한다', () => {
  for (const scenario of contract.scenarios) {
    const phases = new Set(['initial', ...(scenario.actions ?? []).map(a => a.phase)]);
    for (const target of scenario.targets) {
      assert.ok(phases.has(target.phase), `${scenario.id}/${target.id}: phase`);
      assert.ok(target.minimumObserved > 0);
      new RegExp(target.labelPattern, 'u'); new RegExp(target.ownerPattern, 'u');
      for (const entry of target.sourceEntries) {
        const at = entry.lastIndexOf(':'); const line = Number(entry.slice(at + 1));
        const lines = readFileSync(resolve(root, entry.slice(0, at)), 'utf8').split(/\r?\n/);
        assert.ok(line > 0 && line <= lines.length, entry);
      }
    }
  }
});
