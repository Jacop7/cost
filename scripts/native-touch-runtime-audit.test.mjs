#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyVisibility, compareNativeRatchet, effectiveTouchRect, evaluateNativeArtifact, nativeRatchetSnapshot, physicalHalfPixelTolerance, recomputeNativeArtifactDerived, rectOverlap, resolveActionForFontScale } from './native-touch-runtime-audit.mjs';

test('글자 배율별 스크롤 위치를 같은 계약에서 고른다', () => {
  const action = { kind: 'scroll', yByFontScale: { '1': 1100, '2': 1600 } };
  assert.equal(resolveActionForFontScale(action, 1).y, 1100);
  assert.equal(resolveActionForFontScale(action, 2).y, 1600);
});

test('hitSlop은 모든 host ancestor 중 가까운 native parent frame에서도 잘린다', () => {
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

test('반 물리 픽셀 이내의 가시 영역 반올림은 부분 가시로 제외하지 않는다', () => {
  const result = classifyVisibility(
    { x: 0, y: 0, width: 44, height: 44 },
    [{ frame: { x: 0, y: 0, width: 44, height: 43.81 }, kind: 'nonScroll' }],
    2.625,
  );
  assert.equal(result.visibilityDisposition, 'fullyVisible');
});

test('스크롤 viewport clipping만 판단에서 제외하고 비스크롤 부모 clipping은 판단한다', () => {
  const frame = { x: 0, y: 0, width: 44, height: 44 };
  const clipped = { x: 0, y: 0, width: 44, height: 20 };
  assert.equal(classifyVisibility(frame, [{ frame: clipped, kind: 'scrollViewport' }], 2).visibilityDisposition,
    'excludedScrollableOrRoot');
  assert.equal(classifyVisibility(frame, [{ frame: clipped, kind: 'nonScroll' }], 2).visibilityDisposition,
    'clippedByNonScroll');
});

test('overflow visible인 일반 View 경계는 건너뛰고 실제 스크롤 viewport를 clipping 출처로 삼는다', () => {
  const frame = { x: 0, y: 30, width: 44, height: 44 };
  const result = classifyVisibility(frame, [
    { frame: { x: 0, y: 30, width: 43.7, height: 44 }, kind: 'nonScroll', clipsVisual: false },
    { frame: { x: 0, y: 0, width: 100, height: 40 }, kind: 'scrollViewport', clipsVisual: true },
  ], 2);
  assert.equal(result.visibilityDisposition, 'excludedScrollableOrRoot');
  assert.equal(result.clippingAncestors.length, 1);
  assert.equal(result.clippingAncestors[0].kind, 'scrollViewport');
});

test('overflow hidden 비스크롤 부모의 시각 clipping은 제외하지 않고 실제 미달로 남긴다', () => {
  const input = { device: { density: 2 }, scenarios: [{ id: 'one', phases: [{ id: 'initial', rows: [{
    key: 'clipped', label: '잘린 버튼', ownerChain: ['Other'], nativeTag: 1, parentNativeTag: 2,
    relativeMeasure: [0, 0, 44, 44], windowMeasure: [0, 0, 44, 44], hitSlop: 0,
    ancestors: [{ nativeTag: 2, kind: 'nonScroll', overflow: 'hidden', clipsVisual: true,
      windowMeasure: [0, 0, 44, 20] }],
  }] }] }] };
  const rebuilt = recomputeNativeArtifactDerived(input);
  const row = rebuilt.scenarios[0].phases[0].rows[0];
  assert.equal(row.visibilityDisposition, 'clippedByNonScroll');
  assert.equal(row.visualHeight, 20);
  assert.equal(row.pass44, false);
});

test('좌표계가 다른 비클리핑 wrapper는 터치 영역을 줄이지 않고 직접 부모와 clipping 경계만 제한한다', () => {
  const input = { device: { density: 2 }, scenarios: [{ id: 'one', phases: [{ id: 'initial', rows: [{
    key: 'button', label: '조회', ownerChain: ['Button'], nativeTag: 1, parentNativeTag: 2,
    relativeMeasure: [0, 0, 44, 44], windowMeasure: [0, 50, 44, 44], hitSlop: 0,
    ancestors: [
      { nativeTag: 2, kind: 'nonScroll', clipsVisual: false, clipsTouch: true, windowMeasure: [0, 40, 100, 60] },
      { nativeTag: 3, kind: 'nonScroll', hostName: 'RNSScreenContainer', overflow: 'hidden',
        platformWrapper: true, clipsVisual: false, clipsTouch: false, windowMeasure: [0, -50, 100, 60] },
      { nativeTag: 4, kind: 'root', clipsVisual: true, clipsTouch: true, windowMeasure: [0, 0, 100, 100] },
    ],
  }] }] }] };
  const row = recomputeNativeArtifactDerived(input).scenarios[0].phases[0].rows[0];
  assert.equal(row.effectiveHeight, 44);
  assert.equal(row.visibilityDisposition, 'fullyVisible');
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

test('네이티브 미달·중첩 래칫은 새 항목·악화·known의 무기록 개선을 모두 막는다', () => {
  const evaluation = evaluateNativeArtifact(artifact(40), contract);
  evaluation.materialOverlaps = [{ scenario: 'one', phase: 'initial', left: 'A|버튼|1', right: 'B|버튼|2', width: 2, height: 40 }];
  const known = nativeRatchetSnapshot(evaluation);
  assert.deepEqual(compareNativeRatchet(known, known), []);
  const improved = structuredClone(known);
  improved.observedUnjudged = [];
  improved.materialOverlaps = [];
  assert.match(compareNativeRatchet(improved, known).join('\n'), /사라진 네이티브/);
  const worse = structuredClone(known);
  worse.materialOverlaps[0].maxWidth += 1;
  assert.match(compareNativeRatchet(worse, known).join('\n'), /중첩 악화/);
});

test('유효 영역은 직접 부모뿐 아니라 모든 host 조상의 교집합으로 제한된다', () => {
  const result = effectiveTouchRect(
    { x: 10, y: 10, width: 40, height: 40 },
    [{ x: 0, y: 0, width: 100, height: 100 }, { x: 12, y: 12, width: 36, height: 36 }],
    8,
  );
  assert.deepEqual(result.effective, { left: 12, top: 12, right: 48, bottom: 48 });
  assert.equal(result.width, 36);
  assert.equal(result.height, 36);
  assert.equal(result.clipped, true);
});
