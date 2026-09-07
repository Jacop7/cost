#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  carryAstChangeStage,
  evaluateS4,
  evaluateS4Successor,
  loadBaselineSources,
  loadSources,
} from './design-token-s4-check.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const contract = JSON.parse(readFileSync(join(root, 'scripts/design-token-s4-contract.json'), 'utf8'));
const baseline = loadBaselineSources(root, contract.baselineCommit);
const residualKnown = JSON.parse(readFileSync(join(root, contract.residualStage.contract), 'utf8'));
const residual = {
  before: loadBaselineSources(root, residualKnown.baselineCommit),
  after: loadBaselineSources(root, contract.residualStage.productCommit),
};
const successor = JSON.parse(readFileSync(join(root, 'scripts/design-token-s4-successor.json'), 'utf8'));
const readBlobJson = (oid) => {
  const result = spawnSync('git', ['cat-file', 'blob', oid], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  assert.equal(result.status, 0, `Git blob fixture를 읽지 못했다: ${oid}`);
  return JSON.parse(result.stdout);
};
const previousP0 = readBlobJson(successor.previousP0BaselineBlob);
const sourceP0 = readBlobJson(successor.sourceP0BaselineBlob);
const current = () => loadSources(root);
const evaluateCurrent = (
  sources = current(),
  activeContract = contract,
  activeSuccessor = successor,
  previous = previousP0,
  source = sourceP0,
) => {
  const raw = evaluateS4(sources, activeContract, baseline, residual);
  const overlay = evaluateS4Successor(raw, activeSuccessor, previous, source, sources);
  return overlay.length ? [...raw, ...overlay] : [];
};
const changed = (file, from, to) => {
  const sources = current();
  const text = sources.get(file);
  assert.ok(text?.includes(from), `${file} fixture에 ${from} 없음`);
  sources.set(file, text.replace(from, to));
  return sources;
};

test('저장소 S4 successor 계약이 raw 실패 54건을 전수 분류하고 통과한다', () => {
  assert.deepEqual(evaluateCurrent(), []);
});

test('누적 AST 변경은 S4·S3b·S3c·네이티브 소유 단계를 행별로 보존한다', () => {
  const counts = contract.allowedAstChanges.reduce((result, item) => {
    result[item.stage] = (result[item.stage] ?? 0) + 1;
    return result;
  }, {});
  assert.equal(counts.S4, contract.allowedAstChanges.length
    - contract.downstreamStage.geometryChangesIncludedHere
    - contract.residualStage.geometryChangesIncludedHere
    - contract.nativeStage.geometryChangesIncludedHere
    - (contract.nativeFollowupStage?.geometryChangesIncludedHere ?? 0));
  assert.equal(counts.S3b, contract.downstreamStage.geometryChangesIncludedHere);
  assert.equal(counts.S3c, contract.residualStage.geometryChangesIncludedHere);
  assert.equal(counts.S4a ?? 0, contract.nativeStage.geometryChangesIncludedHere);
  assert.equal(counts.S4b ?? 0, contract.nativeFollowupStage?.geometryChangesIncludedHere ?? 0);
  const broken = structuredClone(contract);
  broken.allowedAstChanges[0].stage = 'S3b';
  assert.match(evaluateCurrent(current(), broken).join('\n'), /S3b 소유 AST 변경/);
});

test('AST 계약 갱신은 같은 선언의 occurrence 이동에도 기존 소유 단계를 보존한다', () => {
  const previous = [{
    file: 'Button.tsx', declaration: 'prop:minHeight#1', before: '40', after: '44', stage: 'S4b',
  }];
  assert.equal(carryAstChangeStage({
    file: 'Button.tsx', declaration: 'prop:minHeight#2', before: '40', after: '44',
  }, previous), 'S4b');
  assert.equal(carryAstChangeStage({
    file: 'Button.tsx', declaration: 'prop:minHeight#2', before: '40', after: '48',
  }, previous), 'S4a');
});

test('S3c 누적 행을 다른 단계로 밀면 승인된 8개 배정과의 결속이 실패한다', () => {
  const broken = structuredClone(contract);
  broken.allowedAstChanges.find((item) => item.stage === 'S3c').stage = 'S4a';
  assert.match(evaluateCurrent(current(), broken).join('\n'), /S3c 소유 AST 변경/);
});

test('S3c 배정 건수를 바꾸면 8개 known 계약과의 양방향 대조가 실패한다', () => {
  const broken = structuredClone(contract);
  broken.residualStage.assignments = 7;
  assert.match(evaluateCurrent(current(), broken).join('\n'), /S3c 승인 배정 8 ≠ 7/);
});

test('S3c 누적 AST 값을 바꾸면 제품 커밋 계산값과의 대조가 실패한다', () => {
  const broken = structuredClone(contract);
  broken.allowedAstChanges.find((item) => item.stage === 'S3c').after = 'space.sm';
  assert.match(evaluateCurrent(current(), broken).join('\n'), /S3c 승인 AST 변경 불일치/);
});

test('스크롤 역할 한 자리를 리터럴로 되돌리면 실패한다', () => {
  const sources = changed('apps/mobile/src/components/history/HistoryLayout.tsx', 'paddingBottom: LAYOUT.scroll.end', 'paddingBottom: 30');
  assert.match(evaluateCurrent(sources).join('\n'), /scrollEnd 40 ≠ 44/);
});

test('Button sm 최소 높이를 줄이면 실패한다', () => {
  const sources = changed('apps/mobile/src/components/kit/Button.tsx', 'minHeight: 44', 'minHeight: 43');
  assert.match(evaluateCurrent(sources).join('\n'), /Button 크기·hitSlop/);
});

test('탭 라벨을 한 줄로 닫으면 실패한다', () => {
  const sources = changed('apps/mobile/app/(tabs)/_layout.tsx', 'numberOfLines={2}', 'numberOfLines={1}');
  assert.match(evaluateCurrent(sources).join('\n'), /탭바 계약 누락/);
});

test('탭 글꼴 배율 변경 시 높이 재측정을 빼면 실패한다', () => {
  const sources = changed('apps/mobile/app/(tabs)/_layout.tsx', '[bottomPad, fontScale]', '[bottomPad]');
  assert.match(evaluateCurrent(sources).join('\n'), /탭바 계약 누락/);
});

test('Modal Sheet에서 safe-area를 빼면 실패한다', () => {
  const sources = changed('apps/mobile/src/components/kit/Sheet.tsx', 'LAYOUT.scroll.end + insets.bottom', 'LAYOUT.scroll.end');
  assert.match(evaluateCurrent(sources).join('\n'), /Modal Sheet safe-area/);
});

test('카테고리 28×20 버튼이 돌아오면 실패한다', () => {
  const sources = changed('apps/mobile/src/features/recipes/screens/CategoryEditScreen.tsx', 'width: 44, height: 44', 'width: 28, height: 20');
  assert.match(evaluateCurrent(sources).join('\n'), /옛 28×20/);
});

test('카테고리 방향 Sheet를 없애면 실패한다', () => {
  const sources = changed('apps/mobile/src/features/recipes/screens/CategoryEditScreen.tsx', 'visible={reordering !== null}', 'visible={false}');
  assert.match(evaluateCurrent(sources).join('\n'), /kit Sheet 순서 선택/);
});

test('알려진 터치 미달을 다시 넣으면 실패한다', () => {
  const sources = current();
  const file = 'scripts/touch-target-known.json';
  const known = JSON.parse(sources.get(file));
  known.entries.push({ at: 'fake:1' });
  sources.set(file, JSON.stringify(known));
  assert.match(evaluateCurrent(sources).join('\n'), /터치 미달 1건/);
});

test('허용 목록 밖 기하 변경은 건수 상쇄와 무관하게 실패한다', () => {
  const sources = changed('apps/mobile/src/components/history/HistoryLayout.tsx', 'paddingHorizontal: 16', 'paddingHorizontal: 17');
  assert.match(evaluateCurrent(sources).join('\n'), /허용 AST diff 불일치/);
});

test('글자 확대에서 제목이 액션 영역을 침범하지 않게 하는 minWidth 계약을 잡는다', () => {
  const sources = changed('apps/mobile/src/components/kit/index.tsx', '<View style={{ flex: 1, minWidth: 0 }}>', '<View style={{ flex: 1, minWidth: 1 }}>');
  assert.match(evaluateCurrent(sources).join('\n'), /P2-HUB-HEADER owner 계약 누락/);
});

test('raw 실패가 한 건 추가되면 봉인 source와의 양방향 대조가 실패한다', () => {
  const raw = evaluateS4(current(), contract, baseline, residual);
  const failures = evaluateS4Successor([...raw, '가짜 신규 실패'], successor, previousP0, sourceP0, current());
  assert.match(failures.join('\n'), /현재 raw 실패가 봉인 source와 다르다/);
});

test('P0 migration의 S4 차집합이 바뀌면 실패한다', () => {
  const broken = structuredClone(sourceP0);
  broken.classificationMigration.failureLineDelta
    .find((entry) => entry.gateId === successor.rawGateId).added.pop();
  assert.match(evaluateCurrent(current(), contract, successor, previousP0, broken).join('\n'), /P0 migration 차집합/);
});

test('raw 실패 분류 한 건을 빼면 전수 분류 대조가 실패한다', () => {
  const broken = structuredClone(successor);
  broken.classifications.pop();
  assert.match(evaluateCurrent(current(), contract, broken).join('\n'), /raw 실패 전수 분류/);
});

test('공용 컴포넌트 소유 계약 needle을 제품에서 빼면 실패한다', () => {
  const sources = changed('apps/mobile/src/components/kit/index.tsx', 'export function HubHeader(', 'export function LegacyHubHeader(');
  assert.match(evaluateCurrent(sources).join('\n'), /P2-HUB-HEADER owner 계약 누락/);
});

test('component transfer 분류 건수를 손으로 바꾸면 실패한다', () => {
  const broken = structuredClone(successor);
  broken.componentOwnershipTransfers[0].failureCount += 1;
  assert.match(evaluateCurrent(current(), contract, broken).join('\n'), /P2-HUB-HEADER 분류 14 ≠ 15/);
});

test('분류 통계만 손으로 바꾸면 exact 총계 대조가 실패한다', () => {
  const broken = structuredClone(successor);
  broken.counts.p3Backlog += 1;
  assert.match(evaluateCurrent(current(), contract, broken).join('\n'), /P3 backlog 총계 40 ≠ 41/);
});

test('P0 baseline blob 계보를 끊으면 실패한다', () => {
  const broken = structuredClone(sourceP0);
  broken.classificationMigration.previousBaselineBlob = successor.sourceP0BaselineBlob;
  assert.match(evaluateCurrent(current(), contract, successor, previousP0, broken).join('\n'), /이전 baseline blob 계보/);
});

test('P0 결정 커밋 계보를 바꾸면 실패한다', () => {
  const broken = structuredClone(successor);
  broken.p0DecisionCommit = broken.reviewedTargetCommit;
  assert.match(evaluateCurrent(current(), contract, broken).join('\n'), /결정 커밋 계보/);
});
