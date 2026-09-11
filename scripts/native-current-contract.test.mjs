import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { captureNativeScenario, centeredScrollOffset, evaluateNativeArtifact } from './native-touch-runtime-audit.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const contract = JSON.parse(readFileSync(resolve(root, 'scripts/native-touch-runtime-contract.json')));

test('스크롤은 확대된 실제 target/content/viewport로 중앙 위치를 구한다', () => {
  const row = { windowMeasure: [28, 1612, 337, 142], ancestors: [
    { hostName: 'RCTScrollContentView', windowMeasure: [0, 111, 393, 2042] },
    { hostName: 'RCTScrollView', overflow: 'scroll', windowMeasure: [0, 111, 393, 486] },
  ] };
  assert.equal(centeredScrollOffset(row), 1329);
  // 같은 content가 이미1000dp 스크롤된 경우에도 목표는 같다.
  assert.equal(centeredScrollOffset({ ...row, windowMeasure: [28, 612, 337, 142],
    ancestors: [{ ...row.ancestors[0], windowMeasure: [0, -889, 393, 2042] }, row.ancestors[1]] }), 1329);
  assert.equal(centeredScrollOffset({ ...row, windowMeasure: [28, 111, 337, 44] }), 0);
  assert.equal(centeredScrollOffset({ ...row, windowMeasure: [28, 2110, 337, 44] }), 1556);
  assert.throws(() => centeredScrollOffset({ ...row, ancestors: [] }), /측정/);
  assert.throws(() => centeredScrollOffset({ ...row, windowMeasure: [0, NaN, 10, 10] }), /측정/);
});

test('부자재 사용량은 고정 y 대신 실제 측정 중앙으로 이동하며 필수 관측을 유지한다', () => {
  const scenario = contract.scenarios.find(s => s.id === 'recipe-add');
  const action = scenario.actions.find(a => a.phase === 'material-row');
  assert.equal(action.align, 'center');
  assert.equal(action.yByFontScale, undefined);
  assert.equal(scenario.targets.find(t => t.id === 'material-quantity-edit').minimumObserved, 1);
});

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
