#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareNativeRatchet, effectiveTouchRect, evaluateNativeArtifact, nativeRatchetSnapshot, physicalHalfPixelTolerance, rectOverlap } from './native-touch-runtime-audit.mjs';

test('hitSlop은 가장 가까운 native parent frame에서 잘린다', () => {
  const result = effectiveTouchRect({ x: 10, y: 10, width: 40, height: 40 }, { x: 0, y: 10, width: 100, height: 40 }, 6);
  assert.equal(result.width, 52);
  assert.equal(result.height, 40);
  assert.equal(result.clipped, true);
});

test('반 물리 픽셀 이내의 43.81dp는 density 2.625에서 44로 판정할 수 있다', () => {
  const tolerance = physicalHalfPixelTolerance(2.625);
  assert.ok(43.80953 + tolerance >= 44);
  assert.ok(43.7 + tolerance < 44);
});

test('같은 부모 형제의 실제 사각형 교차량을 계산한다', () => {
  assert.deepEqual(rectOverlap({ left: 0, top: 0, right: 44, bottom: 44 }, { left: 43.9, top: 0, right: 88, bottom: 44 }), { width: 0.10000000000000142, height: 44 });
});

const contract = {
  platform: 'android', fontScale: 1, minimumTarget: 44, expectedSourceLineage: 1,
  scenarios: [{ id: 'one', targets: [{ id: 'target', phase: 'initial', ownerPattern: 'Owner', labelPattern: '^버튼$', minimumObserved: 1, sourceEntries: ['a.tsx:1'] }] }],
};
const artifact = (height = 44) => ({ platform: 'android', fontScale: 1, device: { density: 2 }, scenarios: [{ id: 'one', phases: [{ id: 'initial', rows: [{ nativeTag: 1, key: 'x', label: '버튼', ownerChain: ['Owner'], effectiveWidth: 44, effectiveHeight: height }], overlaps: [] }] }] });

test('계약 target이 44면 통과한다', () => assert.deepEqual(evaluateNativeArtifact(artifact(), contract).failures, []));

test('계약은 1×·2× 글자 확대만 허용하고 다른 배율은 거부한다', () => {
  const twoScaleContract = { ...contract, fontScales: [1, 2] };
  const two = artifact(); two.fontScale = 2;
  assert.deepEqual(evaluateNativeArtifact(two, twoScaleContract).failures, []);
  const three = artifact(); three.fontScale = 3;
  assert.match(evaluateNativeArtifact(three, twoScaleContract).failures.join('\n'), /fontScale 3/);
});

test('부모 clipping으로 44 미달이면 실패한다', () => assert.match(evaluateNativeArtifact(artifact(40), contract).failures.join('\n'), /실제 44 미달/));

test('target 누락은 조용히 통과하지 않는다', () => {
  const input = artifact(); input.scenarios[0].phases[0].rows = [];
  assert.match(evaluateNativeArtifact(input, contract).failures.join('\n'), /관측 0 < 1/);
});

test('계약 밖 실제 미달은 observedUnjudged에 따로 보존한다', () => {
  const input = artifact(); input.scenarios[0].phases[0].rows.push({ nativeTag: 2, key: 'y', label: '새 버튼', ownerChain: ['Other'], effectiveWidth: 20, effectiveHeight: 20 });
  const result = evaluateNativeArtifact(input, contract);
  assert.equal(result.observedUnjudged.length, 1);
  assert.deepEqual(result.failures, []);
});

test('네이티브 미달·중첩 래칫은 새 항목과 악화를 막고 개선은 허용한다', () => {
  const evaluation = evaluateNativeArtifact(artifact(40), contract);
  evaluation.materialOverlaps = [{ scenario: 'one', phase: 'initial', left: 'A|버튼|1', right: 'B|버튼|2', width: 2, height: 40 }];
  const known = nativeRatchetSnapshot(evaluation);
  assert.deepEqual(compareNativeRatchet(known, known), []);
  const improved = structuredClone(known);
  improved.observedUnjudged = [];
  improved.materialOverlaps = [];
  assert.deepEqual(compareNativeRatchet(improved, known), []);
  const worse = structuredClone(known);
  worse.materialOverlaps[0].maxWidth += 1;
  assert.match(compareNativeRatchet(worse, known).join('\n'), /중첩 악화/);
});
