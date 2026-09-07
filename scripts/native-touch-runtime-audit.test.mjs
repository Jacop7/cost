#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ancestorClipsTouch, classifyVisibility, compareNativeRatchet, effectiveTouchRect, evaluateNativeArtifact, fontScaleMatches, isActiveScreenStateList, nativeRatchetSnapshot, physicalHalfPixelTolerance, recomputeNativeArtifactDerived, rectOverlap, resolveActionForFontScale, resolveActionForRuntime, tabRootForRoute, tabScopedRoute, waitForStableOwner } from './native-touch-runtime-audit.mjs';

test('접근성 2× 셀은 Android exact 2, iOS 2 이상 실제 배율을 받는다', () => {
  const contract = {
    fontScalePolicies: {
      android: { '2': { mode: 'exact', value: 2 } },
      ios: { '2': { mode: 'minimum', value: 2 } },
    },
  };
  assert.equal(fontScaleMatches(contract, 'android', 2, 2), true);
  assert.equal(fontScaleMatches(contract, 'android', 2, 2.143), false);
  assert.equal(fontScaleMatches(contract, 'ios', 2, 2.143), true);
  assert.equal(fontScaleMatches(contract, 'ios', 2, 1.999), false);
});

test('탭 route는 실제 (tabs) 그룹을 명시한다', () => {
  assert.equal(tabScopedRoute('/recipes'), '/(tabs)/recipes');
  assert.equal(tabScopedRoute('/ingredients/discards/1'), '/(tabs)/ingredients/discards/1');
  assert.equal(tabScopedRoute('/sign-in'), '/sign-in');
  assert.equal(tabRootForRoute('/(tabs)/recipes/add?id=1'), '/(tabs)/recipes');
  assert.equal(tabRootForRoute('/sign-in'), null);
});

test('RNSScreen 조상이 있으면 전부 activityState 2인 버튼만 활성으로 센다', () => {
  assert.equal(isActiveScreenStateList([]), true);
  assert.equal(isActiveScreenStateList([2, 2]), true);
  assert.equal(isActiveScreenStateList([2, 0]), false);
});

test('탐색 뒤 활성 owner의 nativeTag 집합이 연속 관측될 때만 진행한다', async () => {
  const samples = [[], [{ nativeTag: 1 }], [{ nativeTag: 2 }], [{ nativeTag: 2 }], [{ nativeTag: 2 }]];
  const evaluate = async () => JSON.stringify(samples.shift() ?? []);
  assert.deepEqual(await waitForStableOwner(evaluate, 'Owner', { attempts: 5, consecutive: 3, delayMs: 0 }), [{ nativeTag: 2 }]);
});

test('글자 배율별 스크롤 위치를 같은 계약에서 고른다', () => {
  const action = { kind: 'scroll', yByFontScale: { '1': 1100, '2': 1600 } };
  assert.equal(resolveActionForFontScale(action, 1).y, 1100);
  assert.equal(resolveActionForFontScale(action, 2).y, 1600);
});

test('플랫폼·글자 배율별 스크롤 위치가 공통 배율값보다 우선한다', () => {
  const action = {
    kind: 'scroll',
    xByFontScale: { '2': 200 },
    yByFontScale: { '2': 1600 },
    yByRuntime: { 'android@2': 3000, 'ios@2': 1800 },
  };
  assert.deepEqual(resolveActionForRuntime(action, 'ios', 2), { ...action, x: 200, y: 1800 });
  assert.deepEqual(resolveActionForRuntime(action, 'android', 2), { ...action, x: 200, y: 3000 });
});

test('사각형 계산기는 전달된 터치 경계에서 hitSlop을 자른다', () => {
  const result = effectiveTouchRect({ x: 10, y: 10, width: 40, height: 40 }, { x: 0, y: 10, width: 100, height: 40 }, 6);
  assert.equal(result.width, 52);
  assert.equal(result.height, 40);
  assert.equal(result.clipped, true);
});

test('직접 부모와 명시적 clipping은 Android와 iOS의 공통 터치 경계다', () => {
  const visible = { clipsVisual: false };
  const hidden = { clipsVisual: true };
  assert.equal(ancestorClipsTouch(visible, 0, 'android'), true);
  assert.equal(ancestorClipsTouch(visible, 0, 'ios'), true);
  assert.equal(ancestorClipsTouch(hidden, 1, 'android'), true);
  assert.equal(ancestorClipsTouch(hidden, 1, 'ios'), true);
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

test('Android는 직접 부모를 제한하고 좌표계가 다른 비클리핑 wrapper는 건너뛴다', () => {
  const input = { platform: 'android', device: { density: 2 }, scenarios: [{ id: 'one', phases: [{ id: 'initial', rows: [{
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

test('iOS도 overflow-visible 직접 부모에서 hitSlop을 자른다', () => {
  const input = { platform: 'ios', device: { density: 3 }, scenarios: [{ id: 'one', phases: [{ id: 'initial', rows: [{
    key: 'button', label: '조회', ownerChain: ['Button'], nativeTag: 1, parentNativeTag: 2,
    relativeMeasure: [0, 0, 20, 20], windowMeasure: [10, 10, 20, 20], hitSlop: 20,
    ancestors: [
      { nativeTag: 2, kind: 'nonScroll', clipsVisual: false, windowMeasure: [10, 10, 20, 20] },
      { nativeTag: 3, kind: 'root', clipsVisual: true, windowMeasure: [0, 0, 100, 100] },
    ],
  }] }] }] };
  const row = recomputeNativeArtifactDerived(input).scenarios[0].phases[0].rows[0];
  assert.deepEqual(row.effectiveRect, { left: 10, top: 10, right: 30, bottom: 30 });
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
