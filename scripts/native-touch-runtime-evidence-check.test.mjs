#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildEvidenceReceipt, receiptHashFailures, scaledLayoutWitness, scaledLayoutWitnessMeets, validateArtifactData, validateIosIdentitySupplement, validateTapProbeData, verifyEvidenceReceipt, verifyRepositoryEvidence } from './native-touch-runtime-evidence-check.mjs';
import { productScopeChanged } from './native-product-evidence-scope.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const json = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const contract = json('scripts/native-touch-runtime-contract.json');
const known = json('scripts/native-touch-runtime-known.json');
const source = json('docs/prototypes/native-touch-android-1x.json');
const tapProbe = json('docs/prototypes/native-touch-android-tap-probe.json');
const expected = {
  name: 'fixture', platform: 'android', evidenceScale: 1,
  scriptSha256: source.manifest.scriptSha256,
  contractSha256: source.manifest.contractSha256,
};

test('closedPlatforms의 exact 증거는 원시 frame 재계산과 현재 제품 범위에 결속된다', () => {
  assert.deepEqual(verifyRepositoryEvidence(root, { requirePlatforms: ['android'] }).failures, []);
});

test('프로토타입 SHA만 담는 생성 레지스트리는 네이티브 제품 증거를 무효화하지 않는다', () => {
  const productCommit = source.manifest.productCommit;
  assert.notEqual(spawnSync('git', ['diff', '--quiet', productCommit, 'HEAD', '--', 'apps/mobile'], { cwd: root }).status, 0);
  assert.equal(productScopeChanged(root, productCommit), false);
});

test('작은 영수증도 원시 증거·제품 SHA·검사 계약 해시에 결속된다', () => {
  const verification = verifyRepositoryEvidence(root, { requirePlatforms: ['android'] });
  const receipt = buildEvidenceReceipt(root, verification, ['android']);
  assert.equal(receipt.status, 'PASS');
  assert.deepEqual(receipt.requirePlatforms, ['android']);
  assert.equal(receipt.cells.length, 2);
  assert.equal(receipt.tapProbeCells.length, 1);
  assert.equal(receipt.tapProbeCells[0].probeCount, 3);
  assert.deepEqual(receipt.cells.map((cell) => cell.coverage), [
    { observedRows: 246, fullyVisibleRows: 165, excludedScrollableOrRootRows: 81, targetShortCount: 0 },
    { observedRows: 246, fullyVisibleRows: 127, excludedScrollableOrRootRows: 119, targetShortCount: 0 },
  ]);
  assert.ok(receipt.cells.every((cell) => cell.status === 'PRESENT' && cell.textSha256.length === 64));
  assert.equal(new Set(receipt.cells.map((cell) => cell.productCommit)).size, 1);
  assert.ok(Object.values(receipt.contracts).every((item) => item.textSha256.length === 64));
});

test('Android 실제 탭은 안쪽 발화·직접 부모 밖 차단·overflow visible 조부모 밖 발화를 요구한다', () => {
  const expectedTap = {
    name: 'tap-fixture', platform: 'android',
    scriptSha256: tapProbe.manifest.scriptSha256,
    auditSha256: tapProbe.manifest.auditSha256,
    contractSha256: tapProbe.manifest.contractSha256,
  };
  assert.deepEqual(validateTapProbeData(tapProbe, expectedTap), []);
  const repeatedPhysicalTap = structuredClone(tapProbe);
  repeatedPhysicalTap.empiricalTapProbe.find((item) => item.id === 'inside-effective-rect').onPressCount = 4;
  assert.deepEqual(validateTapProbeData(repeatedPhysicalTap, expectedTap), []);
  const broken = structuredClone(tapProbe);
  broken.empiricalTapProbe.find((item) => item.id === 'outside-overflow-visible-grandparent').onPressCount = 0;
  assert.match(validateTapProbeData(broken, expectedTap).join('\n'), /outside-overflow-visible-grandparent/);
});

test('iOS 실제 탭도 overflow-visible 직접 부모 밖에서 차단돼야 한다', () => {
  // clean checkout에서도 재현되는 커밋 증거만 fixture로 쓴다. 작업 중간의 .tmp 산출물은
  // 제품 저장소 계약이 아니며 verify를 우연히 현재 작업 폴더에 의존하게 만든다.
  const ios = json('docs/prototypes/native-touch-ios-tap-probe.json');
  assert.deepEqual(validateTapProbeData(ios, { name: 'ios-tap', platform: 'ios' }), []);
  const broken = structuredClone(ios);
  broken.empiricalTapProbe.find((item) => item.id === 'outside-direct-parent').onPressCount = 1;
  assert.match(validateTapProbeData(broken, { name: 'ios-tap', platform: 'ios' }).join('\n'), /outside-direct-parent/);
});

test('iOS identity 보충은 exact 기기와 배율별 콘텐츠 viewport를 재계산한다', () => {
  const ios = json('docs/prototypes/native-touch-ios-2x.json');
  const tap = json('docs/prototypes/native-touch-ios-tap-probe.json');
  assert.deepEqual(validateIosIdentitySupplement(ios, tap, 'ios-2x'), []);
  const wrongId = structuredClone(ios);
  wrongId.device.id = '00008130-other';
  assert.match(validateIosIdentitySupplement(wrongId, tap, 'ios-2x').join('\n'), /exact 기기 ID/);
  const forged = structuredClone(ios);
  forged.manifest.deviceIdentitySupplement.observed.sourceContentViewportDp.height += 1;
  assert.match(validateIosIdentitySupplement(forged, tap, 'ios-2x').join('\n'), /재계산과 다르다/);
});

test('커밋된 영수증은 현재 원시 증거와 exact 일치하고 closedPlatforms와 같은 범위를 요구한다', () => {
  const result = verifyEvidenceReceipt(root);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.receipt.requirePlatforms, contract.closedPlatforms);
});

test('원시 증거가 한 바이트라도 달라지면 영수증 검증이 실패한다', () => {
  const sourcePath = join(root, 'docs/prototypes/native-touch-android-1x.json');
  const original = readFileSync(sourcePath, 'utf8');
  const temp = mkdtempSync(join(tmpdir(), 'native-touch-receipt-'));
  const receipt = json('docs/prototypes/native-touch-android-receipt.json');
  try {
    const changedPath = join(temp, 'native-touch-android-1x.json');
    writeFileSync(changedPath, `${original} `);
    const changedHash = createHash('sha256').update(readFileSync(changedPath, 'utf8').replace(/\r\n/g, '\n')).digest('hex');
    assert.notEqual(changedHash, receipt.cells.find((cell) => cell.file === 'native-touch-android-1x.json').textSha256);
    const failures = receiptHashFailures(root, receipt, (cell) =>
      cell.file === 'native-touch-android-1x.json' ? changedPath : join(root, 'docs/prototypes', cell.file));
    assert.match(failures.join('\n'), /영수증 원시 증거 해시 불일치: native-touch-android-1x\.json/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('전체 4칸 요구는 iOS 증거가 없으면 MISSING으로 설명하고, 있으면 전부 검증한다', () => {
  const failures = verifyRepositoryEvidence(root, { requirePlatforms: ['android', 'ios'] }).failures;
  const iosExists = ['native-touch-ios-1x.json', 'native-touch-ios-2x.json']
    .every((name) => { try { readFileSync(join(root, 'docs/prototypes', name)); return true; } catch { return false; } });
  if (iosExists) {
    const one = json('docs/prototypes/native-touch-ios-1x.json');
    const two = json('docs/prototypes/native-touch-ios-2x.json');
    const witness = scaledLayoutWitness(one, two);
    if (witness.dimensionChanged) assert.deepEqual(failures, []);
    else assert.match(failures.join('\n'), /크기가 달라진 동일 제품 frame이 없다/);
  }
  else assert.match(failures.join('\n'), /MISSING native-touch-ios-1x\.json.*MISSING native-touch-ios-2x\.json/s);
});

test('iOS 2× 셀은 위치 이동만이 아니라 같은 제품 frame의 크기 변화를 보여야 한다', () => {
  const one = { scenarios: [{ id: 'a', phases: [{ id: 'initial', rows: [
    { ownerChain: ['Row'], label: '메뉴', windowMeasure: [0, 10, 80, 40] },
  ] }] }] };
  const shifted = structuredClone(one);
  shifted.scenarios[0].phases[0].rows[0].windowMeasure = [0, -140, 80, 40];
  assert.deepEqual(scaledLayoutWitness(one, shifted), { paired: 1, dimensionChanged: 0 });
  shifted.scenarios[0].phases[0].rows[0].windowMeasure = [0, -140, 100, 60];
  assert.deepEqual(scaledLayoutWitness(one, shifted), { paired: 1, dimensionChanged: 1 });
});

test('확대 frame 증인은 한 건이 아니라 계약 비율 하한을 지킨다', () => {
  assert.ok(contract.scaledLayoutWitness.minimumDimensionChangedRatio >= 0.3);
  const one = { scenarios: [{ id: 'a', phases: [{ id: 'initial', rows: Array.from({ length: 10 }, (_, index) => ({
    ownerChain: ['Row'], label: `메뉴-${index}`, windowMeasure: [0, index * 50, 80, 40],
  })) }] }] };
  const under = structuredClone(one);
  under.scenarios[0].phases[0].rows[0].windowMeasure[2] = 100;
  under.scenarios[0].phases[0].rows[1].windowMeasure[2] = 100;
  const exact = structuredClone(under);
  exact.scenarios[0].phases[0].rows[2].windowMeasure[2] = 100;
  assert.equal(scaledLayoutWitnessMeets(scaledLayoutWitness(one, under), contract.scaledLayoutWitness.minimumDimensionChangedRatio), false);
  assert.equal(scaledLayoutWitnessMeets(scaledLayoutWitness(one, exact), contract.scaledLayoutWitness.minimumDimensionChangedRatio), true);
});

test('저장 요약만 0으로 고쳐도 원시 frame 재계산이 잡는다', () => {
  const broken = structuredClone(source);
  broken.scenarios[0].phases[0].rows[0].effectiveHeight = 20;
  assert.match(validateArtifactData(broken, contract, known, expected).join('\n'), /원시 frame 재계산/);
});

test('저장 effectiveWidth만 통과값으로 조작해도 원시 frame 재계산이 잡는다', () => {
  const broken = structuredClone(source);
  broken.scenarios[0].phases[0].rows[0].effectiveWidth = 20;
  assert.match(validateArtifactData(broken, contract, known, expected).join('\n'), /저장 effectiveWidth/);
});

test('저장 overlaps를 비워도 원시 frame 재계산이 잡는다', () => {
  const broken = structuredClone(source);
  const phase = broken.scenarios[0].phases[0];
  const right = structuredClone(phase.rows[0]);
  right.key = `${right.key}-overlap`;
  right.nativeTag += 999999;
  phase.rows.push(right);
  phase.overlaps = [];
  assert.match(validateArtifactData(broken, contract, known, expected).join('\n'), /저장 overlaps/);
});

test('진단 산출물을 exact 증거로 받지 않는다', () => {
  const broken = structuredClone(source);
  broken.manifest.evidenceStatus = 'DIAGNOSTIC_DIRTY_NOT_EVIDENCE';
  assert.match(validateArtifactData(broken, contract, known, expected).join('\n'), /exact commit/);
});

test('현재 파생 감사기나 계약 SHA가 달라지면 낡은 증거다', () => {
  const broken = structuredClone(source);
  broken.manifest.derivation.auditSha256 = '0'.repeat(64);
  broken.manifest.derivation.contractSha256 = '1'.repeat(64);
  assert.match(validateArtifactData(broken, contract, known, expected).join('\n'), /파생 감사기 SHA 불일치/);
  assert.match(validateArtifactData(broken, contract, known, expected).join('\n'), /파생 계약 SHA 불일치/);
});

test('iOS는 model·OS를 요구하지만 Android 전용 API level을 요구하지 않는다', () => {
  const ios = structuredClone(source);
  ios.platform = 'ios'; ios.fontScale = 1;
  ios.manifest.evidenceScale = 1;
  ios.device = { ...ios.device, id: '00008110-example', model: 'iPhone', osVersion: '18.6', apiLevel: null };
  const failures = validateArtifactData(ios, contract, known, { ...expected, platform: 'ios', evidenceScale: 1 });
  assert.doesNotMatch(failures.join('\n'), /API 식별/);
});
